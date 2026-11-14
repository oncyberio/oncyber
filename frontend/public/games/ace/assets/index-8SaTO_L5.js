(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&i(o)}).observe(document,{childList:!0,subtree:!0});function t(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function i(s){if(s.ep)return;s.ep=!0;const r=t(s);fetch(s.href,r)}})();/**
 * @license
 * Copyright 2010-2025 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const vs="180",Kg=0,cd=1,Zg=2,uA=1,hA=2,gi=3,Ci=0,Yt=1,nn=2,Qi=0,_r=1,Fo=2,ud=3,hd=4,$g=5,as=100,e0=101,t0=102,n0=103,i0=104,s0=200,r0=201,o0=202,a0=203,Mu=204,Su=205,l0=206,c0=207,u0=208,h0=209,d0=210,f0=211,p0=212,A0=213,m0=214,wu=0,Cu=1,Iu=2,Cr=3,Tu=4,Ru=5,Bu=6,Lu=7,vh=0,g0=1,_0=2,Hi=0,v0=1,x0=2,E0=3,dA=4,b0=5,y0=6,M0=7,dd="attached",S0="detached",fA=300,xs=301,Ir=302,Du=303,Pu=304,kl=306,Es=1e3,bi=1001,ml=1002,Gt=1003,xh=1004,Eo=1005,Jt=1006,rl=1007,Gn=1008,tt=1009,pA=1010,AA=1011,No=1012,Eh=1013,bs=1014,sn=1015,Ln=1016,bh=1017,yh=1018,Oo=1020,Ql=35902,Hl=35899,mA=1021,ko=1022,Ht=1023,Qo=1026,Ho=1027,Oi=1028,Mh=1029,ds=1030,Sh=1031,wh=1033,vr=33776,gs=33777,xr=33778,Co=33779,gl=35840,Uu=35841,Tr=35842,Go=35843,_l=36196,zo=37492,Vo=37496,_s=37808,Fu=37809,Nu=37810,Ou=37811,Er=37812,ku=37813,Qu=37814,Hu=37815,Gu=37816,zu=37817,Vu=37818,Wu=37819,qu=37820,Xu=37821,Rr=36492,Yu=36494,vl=36495,xl=36283,El=36284,bl=36285,yl=36286,Wo=2300,qo=2301,nc=2302,fd=2400,pd=2401,Ad=2402,w0=2500,C0=0,gA=1,ju=2,I0=3200,T0=3201,na=0,R0=1,ti="",Bt="srgb",rn="srgb-linear",Ml="linear",Et="srgb",Us=7680,md=519,B0=512,L0=513,D0=514,_A=515,P0=516,U0=517,F0=518,N0=519,Ju=35044,fs=35048,gd="300 es",ii=2e3,Sl=2001;class Qr{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(t)===-1&&i[e].push(t)}hasEventListener(e,t){const i=this._listeners;return i===void 0?!1:i[e]!==void 0&&i[e].indexOf(t)!==-1}removeEventListener(e,t){const i=this._listeners;if(i===void 0)return;const s=i[e];if(s!==void 0){const r=s.indexOf(t);r!==-1&&s.splice(r,1)}}dispatchEvent(e){const t=this._listeners;if(t===void 0)return;const i=t[e.type];if(i!==void 0){e.target=this;const s=i.slice(0);for(let r=0,o=s.length;r<o;r++)s[r].call(this,e);e.target=null}}}const Kt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let _d=1234567;const Io=Math.PI/180,Br=180/Math.PI;function Fn(){const n=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Kt[n&255]+Kt[n>>8&255]+Kt[n>>16&255]+Kt[n>>24&255]+"-"+Kt[e&255]+Kt[e>>8&255]+"-"+Kt[e>>16&15|64]+Kt[e>>24&255]+"-"+Kt[t&63|128]+Kt[t>>8&255]+"-"+Kt[t>>16&255]+Kt[t>>24&255]+Kt[i&255]+Kt[i>>8&255]+Kt[i>>16&255]+Kt[i>>24&255]).toLowerCase()}function nt(n,e,t){return Math.max(e,Math.min(t,n))}function Ch(n,e){return(n%e+e)%e}function O0(n,e,t,i,s){return i+(n-e)*(s-i)/(t-e)}function k0(n,e,t){return n!==e?(t-n)/(e-n):0}function To(n,e,t){return(1-t)*n+t*e}function Q0(n,e,t,i){return To(n,e,1-Math.exp(-t*i))}function H0(n,e=1){return e-Math.abs(Ch(n,e*2)-e)}function G0(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*(3-2*n))}function z0(n,e,t){return n<=e?0:n>=t?1:(n=(n-e)/(t-e),n*n*n*(n*(n*6-15)+10))}function V0(n,e){return n+Math.floor(Math.random()*(e-n+1))}function W0(n,e){return n+Math.random()*(e-n)}function q0(n){return n*(.5-Math.random())}function X0(n){n!==void 0&&(_d=n);let e=_d+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function Y0(n){return n*Io}function j0(n){return n*Br}function J0(n){return(n&n-1)===0&&n!==0}function K0(n){return Math.pow(2,Math.ceil(Math.log(n)/Math.LN2))}function Z0(n){return Math.pow(2,Math.floor(Math.log(n)/Math.LN2))}function $0(n,e,t,i,s){const r=Math.cos,o=Math.sin,a=r(t/2),l=o(t/2),c=r((e+i)/2),u=o((e+i)/2),h=r((e-i)/2),d=o((e-i)/2),f=r((i-e)/2),A=o((i-e)/2);switch(s){case"XYX":n.set(a*u,l*h,l*d,a*c);break;case"YZY":n.set(l*d,a*u,l*h,a*c);break;case"ZXZ":n.set(l*h,l*d,a*u,a*c);break;case"XZX":n.set(a*u,l*A,l*f,a*c);break;case"YXY":n.set(l*f,a*u,l*A,a*c);break;case"ZYZ":n.set(l*A,l*f,a*u,a*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function Hn(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return n/4294967295;case Uint16Array:return n/65535;case Uint8Array:return n/255;case Int32Array:return Math.max(n/2147483647,-1);case Int16Array:return Math.max(n/32767,-1);case Int8Array:return Math.max(n/127,-1);default:throw new Error("Invalid component type.")}}function gt(n,e){switch(e.constructor){case Float32Array:return n;case Uint32Array:return Math.round(n*4294967295);case Uint16Array:return Math.round(n*65535);case Uint8Array:return Math.round(n*255);case Int32Array:return Math.round(n*2147483647);case Int16Array:return Math.round(n*32767);case Int8Array:return Math.round(n*127);default:throw new Error("Invalid component type.")}}const wt={DEG2RAD:Io,RAD2DEG:Br,generateUUID:Fn,clamp:nt,euclideanModulo:Ch,mapLinear:O0,inverseLerp:k0,lerp:To,damp:Q0,pingpong:H0,smoothstep:G0,smootherstep:z0,randInt:V0,randFloat:W0,randFloatSpread:q0,seededRandom:X0,degToRad:Y0,radToDeg:j0,isPowerOfTwo:J0,ceilPowerOfTwo:K0,floorPowerOfTwo:Z0,setQuaternionFromProperEuler:$0,normalize:gt,denormalize:Hn};class ce{constructor(e=0,t=0){ce.prototype.isVector2=!0,this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,i=this.y,s=e.elements;return this.x=s[0]*t+s[3]*i+s[6],this.y=s[1]*t+s[4]*i+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=nt(this.x,e.x,t.x),this.y=nt(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=nt(this.x,e,t),this.y=nt(this.y,e,t),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(nt(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const i=this.dot(e)/t;return Math.acos(nt(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,i=this.y-e.y;return t*t+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const i=Math.cos(t),s=Math.sin(t),r=this.x-e.x,o=this.y-e.y;return this.x=r*i-o*s+e.x,this.y=r*s+o*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class je{constructor(e=0,t=0,i=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=i,this._w=s}static slerpFlat(e,t,i,s,r,o,a){let l=i[s+0],c=i[s+1],u=i[s+2],h=i[s+3];const d=r[o+0],f=r[o+1],A=r[o+2],g=r[o+3];if(a===0){e[t+0]=l,e[t+1]=c,e[t+2]=u,e[t+3]=h;return}if(a===1){e[t+0]=d,e[t+1]=f,e[t+2]=A,e[t+3]=g;return}if(h!==g||l!==d||c!==f||u!==A){let m=1-a;const p=l*d+c*f+u*A+h*g,E=p>=0?1:-1,v=1-p*p;if(v>Number.EPSILON){const x=Math.sqrt(v),S=Math.atan2(x,p*E);m=Math.sin(m*S)/x,a=Math.sin(a*S)/x}const _=a*E;if(l=l*m+d*_,c=c*m+f*_,u=u*m+A*_,h=h*m+g*_,m===1-a){const x=1/Math.sqrt(l*l+c*c+u*u+h*h);l*=x,c*=x,u*=x,h*=x}}e[t]=l,e[t+1]=c,e[t+2]=u,e[t+3]=h}static multiplyQuaternionsFlat(e,t,i,s,r,o){const a=i[s],l=i[s+1],c=i[s+2],u=i[s+3],h=r[o],d=r[o+1],f=r[o+2],A=r[o+3];return e[t]=a*A+u*h+l*f-c*d,e[t+1]=l*A+u*d+c*h-a*f,e[t+2]=c*A+u*f+a*d-l*h,e[t+3]=u*A-a*h-l*d-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,i,s){return this._x=e,this._y=t,this._z=i,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const i=e._x,s=e._y,r=e._z,o=e._order,a=Math.cos,l=Math.sin,c=a(i/2),u=a(s/2),h=a(r/2),d=l(i/2),f=l(s/2),A=l(r/2);switch(o){case"XYZ":this._x=d*u*h+c*f*A,this._y=c*f*h-d*u*A,this._z=c*u*A+d*f*h,this._w=c*u*h-d*f*A;break;case"YXZ":this._x=d*u*h+c*f*A,this._y=c*f*h-d*u*A,this._z=c*u*A-d*f*h,this._w=c*u*h+d*f*A;break;case"ZXY":this._x=d*u*h-c*f*A,this._y=c*f*h+d*u*A,this._z=c*u*A+d*f*h,this._w=c*u*h-d*f*A;break;case"ZYX":this._x=d*u*h-c*f*A,this._y=c*f*h+d*u*A,this._z=c*u*A-d*f*h,this._w=c*u*h+d*f*A;break;case"YZX":this._x=d*u*h+c*f*A,this._y=c*f*h+d*u*A,this._z=c*u*A-d*f*h,this._w=c*u*h-d*f*A;break;case"XZY":this._x=d*u*h-c*f*A,this._y=c*f*h-d*u*A,this._z=c*u*A+d*f*h,this._w=c*u*h+d*f*A;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const i=t/2,s=Math.sin(i);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,i=t[0],s=t[4],r=t[8],o=t[1],a=t[5],l=t[9],c=t[2],u=t[6],h=t[10],d=i+a+h;if(d>0){const f=.5/Math.sqrt(d+1);this._w=.25/f,this._x=(u-l)*f,this._y=(r-c)*f,this._z=(o-s)*f}else if(i>a&&i>h){const f=2*Math.sqrt(1+i-a-h);this._w=(u-l)/f,this._x=.25*f,this._y=(s+o)/f,this._z=(r+c)/f}else if(a>h){const f=2*Math.sqrt(1+a-i-h);this._w=(r-c)/f,this._x=(s+o)/f,this._y=.25*f,this._z=(l+u)/f}else{const f=2*Math.sqrt(1+h-i-a);this._w=(o-s)/f,this._x=(r+c)/f,this._y=(l+u)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let i=e.dot(t)+1;return i<1e-8?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(nt(this.dot(e),-1,1)))}rotateTowards(e,t){const i=this.angleTo(e);if(i===0)return this;const s=Math.min(1,t/i);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const i=e._x,s=e._y,r=e._z,o=e._w,a=t._x,l=t._y,c=t._z,u=t._w;return this._x=i*u+o*a+s*c-r*l,this._y=s*u+o*l+r*a-i*c,this._z=r*u+o*c+i*l-s*a,this._w=o*u-i*a-s*l-r*c,this._onChangeCallback(),this}slerp(e,t){if(t===0)return this;if(t===1)return this.copy(e);const i=this._x,s=this._y,r=this._z,o=this._w;let a=o*e._w+i*e._x+s*e._y+r*e._z;if(a<0?(this._w=-e._w,this._x=-e._x,this._y=-e._y,this._z=-e._z,a=-a):this.copy(e),a>=1)return this._w=o,this._x=i,this._y=s,this._z=r,this;const l=1-a*a;if(l<=Number.EPSILON){const f=1-t;return this._w=f*o+t*this._w,this._x=f*i+t*this._x,this._y=f*s+t*this._y,this._z=f*r+t*this._z,this.normalize(),this}const c=Math.sqrt(l),u=Math.atan2(c,a),h=Math.sin((1-t)*u)/c,d=Math.sin(t*u)/c;return this._w=o*h+this._w*d,this._x=i*h+this._x*d,this._y=s*h+this._y*d,this._z=r*h+this._z*d,this._onChangeCallback(),this}slerpQuaternions(e,t,i){return this.copy(e).slerp(t,i)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),i=Math.random(),s=Math.sqrt(1-i),r=Math.sqrt(i);return this.set(s*Math.sin(e),s*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class w{constructor(e=0,t=0,i=0){w.prototype.isVector3=!0,this.x=e,this.y=t,this.z=i}set(e,t,i){return i===void 0&&(i=this.z),this.x=e,this.y=t,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(vd.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(vd.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,i=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6]*s,this.y=r[1]*t+r[4]*i+r[7]*s,this.z=r[2]*t+r[5]*i+r[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,i=this.y,s=this.z,r=e.elements,o=1/(r[3]*t+r[7]*i+r[11]*s+r[15]);return this.x=(r[0]*t+r[4]*i+r[8]*s+r[12])*o,this.y=(r[1]*t+r[5]*i+r[9]*s+r[13])*o,this.z=(r[2]*t+r[6]*i+r[10]*s+r[14])*o,this}applyQuaternion(e){const t=this.x,i=this.y,s=this.z,r=e.x,o=e.y,a=e.z,l=e.w,c=2*(o*s-a*i),u=2*(a*t-r*s),h=2*(r*i-o*t);return this.x=t+l*c+o*h-a*u,this.y=i+l*u+a*c-r*h,this.z=s+l*h+r*u-o*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,i=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[4]*i+r[8]*s,this.y=r[1]*t+r[5]*i+r[9]*s,this.z=r[2]*t+r[6]*i+r[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=nt(this.x,e.x,t.x),this.y=nt(this.y,e.y,t.y),this.z=nt(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=nt(this.x,e,t),this.y=nt(this.y,e,t),this.z=nt(this.z,e,t),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(nt(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const i=e.x,s=e.y,r=e.z,o=t.x,a=t.y,l=t.z;return this.x=s*l-r*a,this.y=r*o-i*l,this.z=i*a-s*o,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const i=e.dot(this)/t;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return ic.copy(this).projectOnVector(e),this.sub(ic)}reflect(e){return this.sub(ic.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const i=this.dot(e)/t;return Math.acos(nt(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,i=this.y-e.y,s=this.z-e.z;return t*t+i*i+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,i){const s=Math.sin(t)*e;return this.x=s*Math.sin(i),this.y=Math.cos(t)*e,this.z=s*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,i){return this.x=e*Math.sin(t),this.y=i,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,i=Math.sqrt(1-t*t);return this.x=i*Math.cos(e),this.y=t,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const ic=new w,vd=new je;class ze{constructor(e,t,i,s,r,o,a,l,c){ze.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,i,s,r,o,a,l,c)}set(e,t,i,s,r,o,a,l,c){const u=this.elements;return u[0]=e,u[1]=s,u[2]=a,u[3]=t,u[4]=r,u[5]=l,u[6]=i,u[7]=o,u[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this}extractBasis(e,t,i){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const i=e.elements,s=t.elements,r=this.elements,o=i[0],a=i[3],l=i[6],c=i[1],u=i[4],h=i[7],d=i[2],f=i[5],A=i[8],g=s[0],m=s[3],p=s[6],E=s[1],v=s[4],_=s[7],x=s[2],S=s[5],I=s[8];return r[0]=o*g+a*E+l*x,r[3]=o*m+a*v+l*S,r[6]=o*p+a*_+l*I,r[1]=c*g+u*E+h*x,r[4]=c*m+u*v+h*S,r[7]=c*p+u*_+h*I,r[2]=d*g+f*E+A*x,r[5]=d*m+f*v+A*S,r[8]=d*p+f*_+A*I,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],i=e[1],s=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],u=e[8];return t*o*u-t*a*c-i*r*u+i*a*l+s*r*c-s*o*l}invert(){const e=this.elements,t=e[0],i=e[1],s=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],u=e[8],h=u*o-a*c,d=a*l-u*r,f=c*r-o*l,A=t*h+i*d+s*f;if(A===0)return this.set(0,0,0,0,0,0,0,0,0);const g=1/A;return e[0]=h*g,e[1]=(s*c-u*i)*g,e[2]=(a*i-s*o)*g,e[3]=d*g,e[4]=(u*t-s*l)*g,e[5]=(s*r-a*t)*g,e[6]=f*g,e[7]=(i*l-c*t)*g,e[8]=(o*t-i*r)*g,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,i,s,r,o,a){const l=Math.cos(r),c=Math.sin(r);return this.set(i*l,i*c,-i*(l*o+c*a)+o+e,-s*c,s*l,-s*(-c*o+l*a)+a+t,0,0,1),this}scale(e,t){return this.premultiply(sc.makeScale(e,t)),this}rotate(e){return this.premultiply(sc.makeRotation(-e)),this}translate(e,t){return this.premultiply(sc.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,i,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,i=e.elements;for(let s=0;s<9;s++)if(t[s]!==i[s])return!1;return!0}fromArray(e,t=0){for(let i=0;i<9;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){const i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const sc=new ze;function vA(n){for(let e=n.length-1;e>=0;--e)if(n[e]>=65535)return!0;return!1}function Xo(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function e_(){const n=Xo("canvas");return n.style.display="block",n}const xd={};function Yo(n){n in xd||(xd[n]=!0,console.warn(n))}function t_(n,e,t){return new Promise(function(i,s){function r(){switch(n.clientWaitSync(e,n.SYNC_FLUSH_COMMANDS_BIT,0)){case n.WAIT_FAILED:s();break;case n.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:i()}}setTimeout(r,t)})}const Ed=new ze().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),bd=new ze().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function n_(){const n={enabled:!0,workingColorSpace:rn,spaces:{},convert:function(s,r,o){return this.enabled===!1||r===o||!r||!o||(this.spaces[r].transfer===Et&&(s.r=Mi(s.r),s.g=Mi(s.g),s.b=Mi(s.b)),this.spaces[r].primaries!==this.spaces[o].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===Et&&(s.r=br(s.r),s.g=br(s.g),s.b=br(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===ti?Ml:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,o){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return Yo("THREE.ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),n.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return Yo("THREE.ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),n.colorSpaceToWorking(s,r)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],i=[.3127,.329];return n.define({[rn]:{primaries:e,whitePoint:i,transfer:Ml,toXYZ:Ed,fromXYZ:bd,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Bt},outputColorSpaceConfig:{drawingBufferColorSpace:Bt}},[Bt]:{primaries:e,whitePoint:i,transfer:Et,toXYZ:Ed,fromXYZ:bd,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Bt}}}),n}const lt=n_();function Mi(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function br(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}let Fs;class i_{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let i;if(e instanceof HTMLCanvasElement)i=e;else{Fs===void 0&&(Fs=Xo("canvas")),Fs.width=e.width,Fs.height=e.height;const s=Fs.getContext("2d");e instanceof ImageData?s.putImageData(e,0,0):s.drawImage(e,0,0,e.width,e.height),i=Fs}return i.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=Xo("canvas");t.width=e.width,t.height=e.height;const i=t.getContext("2d");i.drawImage(e,0,0,e.width,e.height);const s=i.getImageData(0,0,e.width,e.height),r=s.data;for(let o=0;o<r.length;o++)r[o]=Mi(r[o]/255)*255;return i.putImageData(s,0,0),t}else if(e.data){const t=e.data.slice(0);for(let i=0;i<t.length;i++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[i]=Math.floor(Mi(t[i]/255)*255):t[i]=Mi(t[i]);return{data:t,width:e.width,height:e.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let s_=0;class Ih{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:s_++}),this.uuid=Fn(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){const t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):t instanceof VideoFrame?e.set(t.displayHeight,t.displayWidth,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const i={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let o=0,a=s.length;o<a;o++)s[o].isDataTexture?r.push(rc(s[o].image)):r.push(rc(s[o]))}else r=rc(s);i.url=r}return t||(e.images[this.uuid]=i),i}}function rc(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?i_.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let r_=0;const oc=new w;class Qt extends Qr{constructor(e=Qt.DEFAULT_IMAGE,t=Qt.DEFAULT_MAPPING,i=bi,s=bi,r=Jt,o=Gn,a=Ht,l=tt,c=Qt.DEFAULT_ANISOTROPY,u=ti){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:r_++}),this.uuid=Fn(),this.name="",this.source=new Ih(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=i,this.wrapT=s,this.magFilter=r,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new ce(0,0),this.repeat=new ce(1,1),this.center=new ce(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new ze,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0}get width(){return this.source.getSize(oc).x}get height(){return this.source.getSize(oc).y}get depth(){return this.source.getSize(oc).z}get image(){return this.source.data}set image(e=null){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(const t in e){const i=e[t];if(i===void 0){console.warn(`THREE.Texture.setValues(): parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){console.warn(`THREE.Texture.setValues(): property '${t}' does not exist.`);continue}s&&i&&s.isVector2&&i.isVector2||s&&i&&s.isVector3&&i.isVector3||s&&i&&s.isMatrix3&&i.isMatrix3?s.copy(i):this[t]=i}}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),t||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==fA)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Es:e.x=e.x-Math.floor(e.x);break;case bi:e.x=e.x<0?0:1;break;case ml:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Es:e.y=e.y-Math.floor(e.y);break;case bi:e.y=e.y<0?0:1;break;case ml:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}Qt.DEFAULT_IMAGE=null;Qt.DEFAULT_MAPPING=fA;Qt.DEFAULT_ANISOTROPY=1;class ft{constructor(e=0,t=0,i=0,s=1){ft.prototype.isVector4=!0,this.x=e,this.y=t,this.z=i,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,i,s){return this.x=e,this.y=t,this.z=i,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,i=this.y,s=this.z,r=this.w,o=e.elements;return this.x=o[0]*t+o[4]*i+o[8]*s+o[12]*r,this.y=o[1]*t+o[5]*i+o[9]*s+o[13]*r,this.z=o[2]*t+o[6]*i+o[10]*s+o[14]*r,this.w=o[3]*t+o[7]*i+o[11]*s+o[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,i,s,r;const l=e.elements,c=l[0],u=l[4],h=l[8],d=l[1],f=l[5],A=l[9],g=l[2],m=l[6],p=l[10];if(Math.abs(u-d)<.01&&Math.abs(h-g)<.01&&Math.abs(A-m)<.01){if(Math.abs(u+d)<.1&&Math.abs(h+g)<.1&&Math.abs(A+m)<.1&&Math.abs(c+f+p-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const v=(c+1)/2,_=(f+1)/2,x=(p+1)/2,S=(u+d)/4,I=(h+g)/4,L=(A+m)/4;return v>_&&v>x?v<.01?(i=0,s=.707106781,r=.707106781):(i=Math.sqrt(v),s=S/i,r=I/i):_>x?_<.01?(i=.707106781,s=0,r=.707106781):(s=Math.sqrt(_),i=S/s,r=L/s):x<.01?(i=.707106781,s=.707106781,r=0):(r=Math.sqrt(x),i=I/r,s=L/r),this.set(i,s,r,t),this}let E=Math.sqrt((m-A)*(m-A)+(h-g)*(h-g)+(d-u)*(d-u));return Math.abs(E)<.001&&(E=1),this.x=(m-A)/E,this.y=(h-g)/E,this.z=(d-u)/E,this.w=Math.acos((c+f+p-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=nt(this.x,e.x,t.x),this.y=nt(this.y,e.y,t.y),this.z=nt(this.z,e.z,t.z),this.w=nt(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=nt(this.x,e,t),this.y=nt(this.y,e,t),this.z=nt(this.z,e,t),this.w=nt(this.w,e,t),this}clampLength(e,t){const i=this.length();return this.divideScalar(i||1).multiplyScalar(nt(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this.w=e.w+(t.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class o_ extends Qr{constructor(e=1,t=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Jt,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},i),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=i.depth,this.scissor=new ft(0,0,e,t),this.scissorTest=!1,this.viewport=new ft(0,0,e,t);const s={width:e,height:t,depth:i.depth},r=new Qt(s);this.textures=[];const o=i.count;for(let a=0;a<o;a++)this.textures[a]=r.clone(),this.textures[a].isRenderTargetTexture=!0,this.textures[a].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview}_setTextureOptions(e={}){const t={minFilter:Jt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,i=1){if(this.width!==e||this.height!==t||this.depth!==i){this.width=e,this.height=t,this.depth=i;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=e,this.textures[s].image.height=t,this.textures[s].image.depth=i,this.textures[s].isArrayTexture=this.textures[s].image.depth>1;this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,i=e.textures.length;t<i;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;const s=Object.assign({},e.textures[t].image);this.textures[t].source=new Ih(s)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class ys extends o_{constructor(e=1,t=1,i={}){super(e,t,i),this.isWebGLRenderTarget=!0}}class xA extends Qt{constructor(e=null,t=1,i=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:i,depth:s},this.magFilter=Gt,this.minFilter=Gt,this.wrapR=bi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class EA extends Qt{constructor(e=null,t=1,i=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:i,depth:s},this.magFilter=Gt,this.minFilter=Gt,this.wrapR=bi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class oi{constructor(e=new w(1/0,1/0,1/0),t=new w(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t+=3)this.expandByPoint(On.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,i=e.count;t<i;t++)this.expandByPoint(On.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const i=On.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const i=e.geometry;if(i!==void 0){const r=i.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let o=0,a=r.count;o<a;o++)e.isMesh===!0?e.getVertexPosition(o,On):On.fromBufferAttribute(r,o),On.applyMatrix4(e.matrixWorld),this.expandByPoint(On);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),da.copy(e.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),da.copy(i.boundingBox)),da.applyMatrix4(e.matrixWorld),this.union(da)}const s=e.children;for(let r=0,o=s.length;r<o;r++)this.expandByObject(s[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,On),On.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,i;return e.normal.x>0?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Kr),fa.subVectors(this.max,Kr),Ns.subVectors(e.a,Kr),Os.subVectors(e.b,Kr),ks.subVectors(e.c,Kr),Ti.subVectors(Os,Ns),Ri.subVectors(ks,Os),Wi.subVectors(Ns,ks);let t=[0,-Ti.z,Ti.y,0,-Ri.z,Ri.y,0,-Wi.z,Wi.y,Ti.z,0,-Ti.x,Ri.z,0,-Ri.x,Wi.z,0,-Wi.x,-Ti.y,Ti.x,0,-Ri.y,Ri.x,0,-Wi.y,Wi.x,0];return!ac(t,Ns,Os,ks,fa)||(t=[1,0,0,0,1,0,0,0,1],!ac(t,Ns,Os,ks,fa))?!1:(pa.crossVectors(Ti,Ri),t=[pa.x,pa.y,pa.z],ac(t,Ns,Os,ks,fa))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,On).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(On).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(hi[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),hi[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),hi[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),hi[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),hi[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),hi[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),hi[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),hi[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(hi),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}const hi=[new w,new w,new w,new w,new w,new w,new w,new w],On=new w,da=new oi,Ns=new w,Os=new w,ks=new w,Ti=new w,Ri=new w,Wi=new w,Kr=new w,fa=new w,pa=new w,qi=new w;function ac(n,e,t,i,s){for(let r=0,o=n.length-3;r<=o;r+=3){qi.fromArray(n,r);const a=s.x*Math.abs(qi.x)+s.y*Math.abs(qi.y)+s.z*Math.abs(qi.z),l=e.dot(qi),c=t.dot(qi),u=i.dot(qi);if(Math.max(-Math.max(l,c,u),Math.min(l,c,u))>a)return!1}return!0}const a_=new oi,Zr=new w,lc=new w;class ai{constructor(e=new w,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const i=this.center;t!==void 0?i.copy(t):a_.setFromPoints(e).getCenter(i);let s=0;for(let r=0,o=e.length;r<o;r++)s=Math.max(s,i.distanceToSquared(e[r]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const i=this.center.distanceToSquared(e);return t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Zr.subVectors(e,this.center);const t=Zr.lengthSq();if(t>this.radius*this.radius){const i=Math.sqrt(t),s=(i-this.radius)*.5;this.center.addScaledVector(Zr,s/i),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(lc.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Zr.copy(e.center).add(lc)),this.expandByPoint(Zr.copy(e.center).sub(lc))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}const di=new w,cc=new w,Aa=new w,Bi=new w,uc=new w,ma=new w,hc=new w;class Gl{constructor(e=new w,t=new w(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,di)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=di.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(di.copy(this.origin).addScaledVector(this.direction,t),di.distanceToSquared(e))}distanceSqToSegment(e,t,i,s){cc.copy(e).add(t).multiplyScalar(.5),Aa.copy(t).sub(e).normalize(),Bi.copy(this.origin).sub(cc);const r=e.distanceTo(t)*.5,o=-this.direction.dot(Aa),a=Bi.dot(this.direction),l=-Bi.dot(Aa),c=Bi.lengthSq(),u=Math.abs(1-o*o);let h,d,f,A;if(u>0)if(h=o*l-a,d=o*a-l,A=r*u,h>=0)if(d>=-A)if(d<=A){const g=1/u;h*=g,d*=g,f=h*(h+o*d+2*a)+d*(o*h+d+2*l)+c}else d=r,h=Math.max(0,-(o*d+a)),f=-h*h+d*(d+2*l)+c;else d=-r,h=Math.max(0,-(o*d+a)),f=-h*h+d*(d+2*l)+c;else d<=-A?(h=Math.max(0,-(-o*r+a)),d=h>0?-r:Math.min(Math.max(-r,-l),r),f=-h*h+d*(d+2*l)+c):d<=A?(h=0,d=Math.min(Math.max(-r,-l),r),f=d*(d+2*l)+c):(h=Math.max(0,-(o*r+a)),d=h>0?r:Math.min(Math.max(-r,-l),r),f=-h*h+d*(d+2*l)+c);else d=o>0?-r:r,h=Math.max(0,-(o*d+a)),f=-h*h+d*(d+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,h),s&&s.copy(cc).addScaledVector(Aa,d),f}intersectSphere(e,t){di.subVectors(e.center,this.origin);const i=di.dot(this.direction),s=di.dot(di)-i*i,r=e.radius*e.radius;if(s>r)return null;const o=Math.sqrt(r-s),a=i-o,l=i+o;return l<0?null:a<0?this.at(l,t):this.at(a,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const i=-(this.origin.dot(e.normal)+e.constant)/t;return i>=0?i:null}intersectPlane(e,t){const i=this.distanceToPlane(e);return i===null?null:this.at(i,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let i,s,r,o,a,l;const c=1/this.direction.x,u=1/this.direction.y,h=1/this.direction.z,d=this.origin;return c>=0?(i=(e.min.x-d.x)*c,s=(e.max.x-d.x)*c):(i=(e.max.x-d.x)*c,s=(e.min.x-d.x)*c),u>=0?(r=(e.min.y-d.y)*u,o=(e.max.y-d.y)*u):(r=(e.max.y-d.y)*u,o=(e.min.y-d.y)*u),i>o||r>s||((r>i||isNaN(i))&&(i=r),(o<s||isNaN(s))&&(s=o),h>=0?(a=(e.min.z-d.z)*h,l=(e.max.z-d.z)*h):(a=(e.max.z-d.z)*h,l=(e.min.z-d.z)*h),i>l||a>s)||((a>i||i!==i)&&(i=a),(l<s||s!==s)&&(s=l),s<0)?null:this.at(i>=0?i:s,t)}intersectsBox(e){return this.intersectBox(e,di)!==null}intersectTriangle(e,t,i,s,r){uc.subVectors(t,e),ma.subVectors(i,e),hc.crossVectors(uc,ma);let o=this.direction.dot(hc),a;if(o>0){if(s)return null;a=1}else if(o<0)a=-1,o=-o;else return null;Bi.subVectors(this.origin,e);const l=a*this.direction.dot(ma.crossVectors(Bi,ma));if(l<0)return null;const c=a*this.direction.dot(uc.cross(Bi));if(c<0||l+c>o)return null;const u=-a*Bi.dot(hc);return u<0?null:this.at(u/o,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Qe{constructor(e,t,i,s,r,o,a,l,c,u,h,d,f,A,g,m){Qe.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,i,s,r,o,a,l,c,u,h,d,f,A,g,m)}set(e,t,i,s,r,o,a,l,c,u,h,d,f,A,g,m){const p=this.elements;return p[0]=e,p[4]=t,p[8]=i,p[12]=s,p[1]=r,p[5]=o,p[9]=a,p[13]=l,p[2]=c,p[6]=u,p[10]=h,p[14]=d,p[3]=f,p[7]=A,p[11]=g,p[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Qe().fromArray(this.elements)}copy(e){const t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this}copyPosition(e){const t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,i){return e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this}makeBasis(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this}extractRotation(e){const t=this.elements,i=e.elements,s=1/Qs.setFromMatrixColumn(e,0).length(),r=1/Qs.setFromMatrixColumn(e,1).length(),o=1/Qs.setFromMatrixColumn(e,2).length();return t[0]=i[0]*s,t[1]=i[1]*s,t[2]=i[2]*s,t[3]=0,t[4]=i[4]*r,t[5]=i[5]*r,t[6]=i[6]*r,t[7]=0,t[8]=i[8]*o,t[9]=i[9]*o,t[10]=i[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,i=e.x,s=e.y,r=e.z,o=Math.cos(i),a=Math.sin(i),l=Math.cos(s),c=Math.sin(s),u=Math.cos(r),h=Math.sin(r);if(e.order==="XYZ"){const d=o*u,f=o*h,A=a*u,g=a*h;t[0]=l*u,t[4]=-l*h,t[8]=c,t[1]=f+A*c,t[5]=d-g*c,t[9]=-a*l,t[2]=g-d*c,t[6]=A+f*c,t[10]=o*l}else if(e.order==="YXZ"){const d=l*u,f=l*h,A=c*u,g=c*h;t[0]=d+g*a,t[4]=A*a-f,t[8]=o*c,t[1]=o*h,t[5]=o*u,t[9]=-a,t[2]=f*a-A,t[6]=g+d*a,t[10]=o*l}else if(e.order==="ZXY"){const d=l*u,f=l*h,A=c*u,g=c*h;t[0]=d-g*a,t[4]=-o*h,t[8]=A+f*a,t[1]=f+A*a,t[5]=o*u,t[9]=g-d*a,t[2]=-o*c,t[6]=a,t[10]=o*l}else if(e.order==="ZYX"){const d=o*u,f=o*h,A=a*u,g=a*h;t[0]=l*u,t[4]=A*c-f,t[8]=d*c+g,t[1]=l*h,t[5]=g*c+d,t[9]=f*c-A,t[2]=-c,t[6]=a*l,t[10]=o*l}else if(e.order==="YZX"){const d=o*l,f=o*c,A=a*l,g=a*c;t[0]=l*u,t[4]=g-d*h,t[8]=A*h+f,t[1]=h,t[5]=o*u,t[9]=-a*u,t[2]=-c*u,t[6]=f*h+A,t[10]=d-g*h}else if(e.order==="XZY"){const d=o*l,f=o*c,A=a*l,g=a*c;t[0]=l*u,t[4]=-h,t[8]=c*u,t[1]=d*h+g,t[5]=o*u,t[9]=f*h-A,t[2]=A*h-f,t[6]=a*u,t[10]=g*h+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(l_,e,c_)}lookAt(e,t,i){const s=this.elements;return _n.subVectors(e,t),_n.lengthSq()===0&&(_n.z=1),_n.normalize(),Li.crossVectors(i,_n),Li.lengthSq()===0&&(Math.abs(i.z)===1?_n.x+=1e-4:_n.z+=1e-4,_n.normalize(),Li.crossVectors(i,_n)),Li.normalize(),ga.crossVectors(_n,Li),s[0]=Li.x,s[4]=ga.x,s[8]=_n.x,s[1]=Li.y,s[5]=ga.y,s[9]=_n.y,s[2]=Li.z,s[6]=ga.z,s[10]=_n.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const i=e.elements,s=t.elements,r=this.elements,o=i[0],a=i[4],l=i[8],c=i[12],u=i[1],h=i[5],d=i[9],f=i[13],A=i[2],g=i[6],m=i[10],p=i[14],E=i[3],v=i[7],_=i[11],x=i[15],S=s[0],I=s[4],L=s[8],y=s[12],b=s[1],R=s[5],U=s[9],N=s[13],G=s[2],V=s[6],P=s[10],Y=s[14],H=s[3],te=s[7],se=s[11],ae=s[15];return r[0]=o*S+a*b+l*G+c*H,r[4]=o*I+a*R+l*V+c*te,r[8]=o*L+a*U+l*P+c*se,r[12]=o*y+a*N+l*Y+c*ae,r[1]=u*S+h*b+d*G+f*H,r[5]=u*I+h*R+d*V+f*te,r[9]=u*L+h*U+d*P+f*se,r[13]=u*y+h*N+d*Y+f*ae,r[2]=A*S+g*b+m*G+p*H,r[6]=A*I+g*R+m*V+p*te,r[10]=A*L+g*U+m*P+p*se,r[14]=A*y+g*N+m*Y+p*ae,r[3]=E*S+v*b+_*G+x*H,r[7]=E*I+v*R+_*V+x*te,r[11]=E*L+v*U+_*P+x*se,r[15]=E*y+v*N+_*Y+x*ae,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],i=e[4],s=e[8],r=e[12],o=e[1],a=e[5],l=e[9],c=e[13],u=e[2],h=e[6],d=e[10],f=e[14],A=e[3],g=e[7],m=e[11],p=e[15];return A*(+r*l*h-s*c*h-r*a*d+i*c*d+s*a*f-i*l*f)+g*(+t*l*f-t*c*d+r*o*d-s*o*f+s*c*u-r*l*u)+m*(+t*c*h-t*a*f-r*o*h+i*o*f+r*a*u-i*c*u)+p*(-s*a*u-t*l*h+t*a*d+s*o*h-i*o*d+i*l*u)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,i){const s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=i),this}invert(){const e=this.elements,t=e[0],i=e[1],s=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],u=e[8],h=e[9],d=e[10],f=e[11],A=e[12],g=e[13],m=e[14],p=e[15],E=h*m*c-g*d*c+g*l*f-a*m*f-h*l*p+a*d*p,v=A*d*c-u*m*c-A*l*f+o*m*f+u*l*p-o*d*p,_=u*g*c-A*h*c+A*a*f-o*g*f-u*a*p+o*h*p,x=A*h*l-u*g*l-A*a*d+o*g*d+u*a*m-o*h*m,S=t*E+i*v+s*_+r*x;if(S===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const I=1/S;return e[0]=E*I,e[1]=(g*d*r-h*m*r-g*s*f+i*m*f+h*s*p-i*d*p)*I,e[2]=(a*m*r-g*l*r+g*s*c-i*m*c-a*s*p+i*l*p)*I,e[3]=(h*l*r-a*d*r-h*s*c+i*d*c+a*s*f-i*l*f)*I,e[4]=v*I,e[5]=(u*m*r-A*d*r+A*s*f-t*m*f-u*s*p+t*d*p)*I,e[6]=(A*l*r-o*m*r-A*s*c+t*m*c+o*s*p-t*l*p)*I,e[7]=(o*d*r-u*l*r+u*s*c-t*d*c-o*s*f+t*l*f)*I,e[8]=_*I,e[9]=(A*h*r-u*g*r-A*i*f+t*g*f+u*i*p-t*h*p)*I,e[10]=(o*g*r-A*a*r+A*i*c-t*g*c-o*i*p+t*a*p)*I,e[11]=(u*a*r-o*h*r-u*i*c+t*h*c+o*i*f-t*a*f)*I,e[12]=x*I,e[13]=(u*g*s-A*h*s+A*i*d-t*g*d-u*i*m+t*h*m)*I,e[14]=(A*a*s-o*g*s-A*i*l+t*g*l+o*i*m-t*a*m)*I,e[15]=(o*h*s-u*a*s+u*i*l-t*h*l-o*i*d+t*a*d)*I,this}scale(e){const t=this.elements,i=e.x,s=e.y,r=e.z;return t[0]*=i,t[4]*=s,t[8]*=r,t[1]*=i,t[5]*=s,t[9]*=r,t[2]*=i,t[6]*=s,t[10]*=r,t[3]*=i,t[7]*=s,t[11]*=r,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,s))}makeTranslation(e,t,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const i=Math.cos(t),s=Math.sin(t),r=1-i,o=e.x,a=e.y,l=e.z,c=r*o,u=r*a;return this.set(c*o+i,c*a-s*l,c*l+s*a,0,c*a+s*l,u*a+i,u*l-s*o,0,c*l-s*a,u*l+s*o,r*l*l+i,0,0,0,0,1),this}makeScale(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,t,i,s,r,o){return this.set(1,i,r,0,e,1,o,0,t,s,1,0,0,0,0,1),this}compose(e,t,i){const s=this.elements,r=t._x,o=t._y,a=t._z,l=t._w,c=r+r,u=o+o,h=a+a,d=r*c,f=r*u,A=r*h,g=o*u,m=o*h,p=a*h,E=l*c,v=l*u,_=l*h,x=i.x,S=i.y,I=i.z;return s[0]=(1-(g+p))*x,s[1]=(f+_)*x,s[2]=(A-v)*x,s[3]=0,s[4]=(f-_)*S,s[5]=(1-(d+p))*S,s[6]=(m+E)*S,s[7]=0,s[8]=(A+v)*I,s[9]=(m-E)*I,s[10]=(1-(d+g))*I,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,i){const s=this.elements;let r=Qs.set(s[0],s[1],s[2]).length();const o=Qs.set(s[4],s[5],s[6]).length(),a=Qs.set(s[8],s[9],s[10]).length();this.determinant()<0&&(r=-r),e.x=s[12],e.y=s[13],e.z=s[14],kn.copy(this);const c=1/r,u=1/o,h=1/a;return kn.elements[0]*=c,kn.elements[1]*=c,kn.elements[2]*=c,kn.elements[4]*=u,kn.elements[5]*=u,kn.elements[6]*=u,kn.elements[8]*=h,kn.elements[9]*=h,kn.elements[10]*=h,t.setFromRotationMatrix(kn),i.x=r,i.y=o,i.z=a,this}makePerspective(e,t,i,s,r,o,a=ii,l=!1){const c=this.elements,u=2*r/(t-e),h=2*r/(i-s),d=(t+e)/(t-e),f=(i+s)/(i-s);let A,g;if(l)A=r/(o-r),g=o*r/(o-r);else if(a===ii)A=-(o+r)/(o-r),g=-2*o*r/(o-r);else if(a===Sl)A=-o/(o-r),g=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=u,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=h,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=A,c[14]=g,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,i,s,r,o,a=ii,l=!1){const c=this.elements,u=2/(t-e),h=2/(i-s),d=-(t+e)/(t-e),f=-(i+s)/(i-s);let A,g;if(l)A=1/(o-r),g=o/(o-r);else if(a===ii)A=-2/(o-r),g=-(o+r)/(o-r);else if(a===Sl)A=-1/(o-r),g=-r/(o-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=u,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=h,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=A,c[14]=g,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){const t=this.elements,i=e.elements;for(let s=0;s<16;s++)if(t[s]!==i[s])return!1;return!0}fromArray(e,t=0){for(let i=0;i<16;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){const i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}}const Qs=new w,kn=new Qe,l_=new w(0,0,0),c_=new w(1,1,1),Li=new w,ga=new w,_n=new w,yd=new Qe,Md=new je;class fn{constructor(e=0,t=0,i=0,s=fn.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=i,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,i,s=this._order){return this._x=e,this._y=t,this._z=i,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,i=!0){const s=e.elements,r=s[0],o=s[4],a=s[8],l=s[1],c=s[5],u=s[9],h=s[2],d=s[6],f=s[10];switch(t){case"XYZ":this._y=Math.asin(nt(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-u,f),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-nt(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(a,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-h,r),this._z=0);break;case"ZXY":this._x=Math.asin(nt(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-h,f),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-nt(h,-1,1)),Math.abs(h)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(nt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-u,c),this._y=Math.atan2(-h,r)):(this._x=0,this._y=Math.atan2(a,f));break;case"XZY":this._z=Math.asin(-nt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-u,f),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,i){return yd.makeRotationFromQuaternion(e),this.setFromRotationMatrix(yd,t,i)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Md.setFromEuler(this),this.setFromQuaternion(Md,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}fn.DEFAULT_ORDER="XYZ";class bA{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let u_=0;const Sd=new w,Hs=new je,fi=new Qe,_a=new w,$r=new w,h_=new w,d_=new je,wd=new w(1,0,0),Cd=new w(0,1,0),Id=new w(0,0,1),Td={type:"added"},f_={type:"removed"},Gs={type:"childadded",child:null},dc={type:"childremoved",child:null};class vt extends Qr{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:u_++}),this.uuid=Fn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=vt.DEFAULT_UP.clone();const e=new w,t=new fn,i=new je,s=new w(1,1,1);function r(){i.setFromEuler(t,!1)}function o(){t.setFromQuaternion(i,void 0,!1)}t._onChange(r),i._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new Qe},normalMatrix:{value:new ze}}),this.matrix=new Qe,this.matrixWorld=new Qe,this.matrixAutoUpdate=vt.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=vt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new bA,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Hs.setFromAxisAngle(e,t),this.quaternion.multiply(Hs),this}rotateOnWorldAxis(e,t){return Hs.setFromAxisAngle(e,t),this.quaternion.premultiply(Hs),this}rotateX(e){return this.rotateOnAxis(wd,e)}rotateY(e){return this.rotateOnAxis(Cd,e)}rotateZ(e){return this.rotateOnAxis(Id,e)}translateOnAxis(e,t){return Sd.copy(e).applyQuaternion(this.quaternion),this.position.add(Sd.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(wd,e)}translateY(e){return this.translateOnAxis(Cd,e)}translateZ(e){return this.translateOnAxis(Id,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(fi.copy(this.matrixWorld).invert())}lookAt(e,t,i){e.isVector3?_a.copy(e):_a.set(e,t,i);const s=this.parent;this.updateWorldMatrix(!0,!1),$r.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?fi.lookAt($r,_a,this.up):fi.lookAt(_a,$r,this.up),this.quaternion.setFromRotationMatrix(fi),s&&(fi.extractRotation(s.matrixWorld),Hs.setFromRotationMatrix(fi),this.quaternion.premultiply(Hs.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Td),Gs.child=e,this.dispatchEvent(Gs),Gs.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(f_),dc.child=e,this.dispatchEvent(dc),dc.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),fi.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),fi.multiply(e.parent.matrixWorld)),e.applyMatrix4(fi),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Td),Gs.child=e,this.dispatchEvent(Gs),Gs.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let i=0,s=this.children.length;i<s;i++){const o=this.children[i].getObjectByProperty(e,t);if(o!==void 0)return o}}getObjectsByProperty(e,t,i=[]){this[e]===t&&i.push(this);const s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].getObjectsByProperty(e,t,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose($r,e,h_),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose($r,d_,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let i=0,s=t.length;i<s;i++)t[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let i=0,s=t.length;i<s;i++)t[i].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let i=0,s=t.length;i<s;i++)t[i].updateMatrixWorld(e)}updateWorldMatrix(e,t){const i=this.parent;if(e===!0&&i!==null&&i.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){const s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].updateWorldMatrix(!1,!0)}}toJSON(e){const t=e===void 0||typeof e=="string",i={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(a=>({...a})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(e),s.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(e.geometries,this.geometry);const a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){const l=a.shapes;if(Array.isArray(l))for(let c=0,u=l.length;c<u;c++){const h=l[c];r(e.shapes,h)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(r(e.materials,this.material[l]));s.material=a}else s.material=r(e.materials,this.material);if(this.children.length>0){s.children=[];for(let a=0;a<this.children.length;a++)s.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let a=0;a<this.animations.length;a++){const l=this.animations[a];s.animations.push(r(e.animations,l))}}if(t){const a=o(e.geometries),l=o(e.materials),c=o(e.textures),u=o(e.images),h=o(e.shapes),d=o(e.skeletons),f=o(e.animations),A=o(e.nodes);a.length>0&&(i.geometries=a),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),u.length>0&&(i.images=u),h.length>0&&(i.shapes=h),d.length>0&&(i.skeletons=d),f.length>0&&(i.animations=f),A.length>0&&(i.nodes=A)}return i.object=s,i;function o(a){const l=[];for(const c in a){const u=a[c];delete u.metadata,l.push(u)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let i=0;i<e.children.length;i++){const s=e.children[i];this.add(s.clone())}return this}}vt.DEFAULT_UP=new w(0,1,0);vt.DEFAULT_MATRIX_AUTO_UPDATE=!0;vt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const Qn=new w,pi=new w,fc=new w,Ai=new w,zs=new w,Vs=new w,Rd=new w,pc=new w,Ac=new w,mc=new w,gc=new ft,_c=new ft,vc=new ft;class Dn{constructor(e=new w,t=new w,i=new w){this.a=e,this.b=t,this.c=i}static getNormal(e,t,i,s){s.subVectors(i,t),Qn.subVectors(e,t),s.cross(Qn);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(e,t,i,s,r){Qn.subVectors(s,t),pi.subVectors(i,t),fc.subVectors(e,t);const o=Qn.dot(Qn),a=Qn.dot(pi),l=Qn.dot(fc),c=pi.dot(pi),u=pi.dot(fc),h=o*c-a*a;if(h===0)return r.set(0,0,0),null;const d=1/h,f=(c*l-a*u)*d,A=(o*u-a*l)*d;return r.set(1-f-A,A,f)}static containsPoint(e,t,i,s){return this.getBarycoord(e,t,i,s,Ai)===null?!1:Ai.x>=0&&Ai.y>=0&&Ai.x+Ai.y<=1}static getInterpolation(e,t,i,s,r,o,a,l){return this.getBarycoord(e,t,i,s,Ai)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,Ai.x),l.addScaledVector(o,Ai.y),l.addScaledVector(a,Ai.z),l)}static getInterpolatedAttribute(e,t,i,s,r,o){return gc.setScalar(0),_c.setScalar(0),vc.setScalar(0),gc.fromBufferAttribute(e,t),_c.fromBufferAttribute(e,i),vc.fromBufferAttribute(e,s),o.setScalar(0),o.addScaledVector(gc,r.x),o.addScaledVector(_c,r.y),o.addScaledVector(vc,r.z),o}static isFrontFacing(e,t,i,s){return Qn.subVectors(i,t),pi.subVectors(e,t),Qn.cross(pi).dot(s)<0}set(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this}setFromPointsAndIndices(e,t,i,s){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,i,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,i),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Qn.subVectors(this.c,this.b),pi.subVectors(this.a,this.b),Qn.cross(pi).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return Dn.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return Dn.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,i,s,r){return Dn.getInterpolation(e,this.a,this.b,this.c,t,i,s,r)}containsPoint(e){return Dn.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return Dn.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const i=this.a,s=this.b,r=this.c;let o,a;zs.subVectors(s,i),Vs.subVectors(r,i),pc.subVectors(e,i);const l=zs.dot(pc),c=Vs.dot(pc);if(l<=0&&c<=0)return t.copy(i);Ac.subVectors(e,s);const u=zs.dot(Ac),h=Vs.dot(Ac);if(u>=0&&h<=u)return t.copy(s);const d=l*h-u*c;if(d<=0&&l>=0&&u<=0)return o=l/(l-u),t.copy(i).addScaledVector(zs,o);mc.subVectors(e,r);const f=zs.dot(mc),A=Vs.dot(mc);if(A>=0&&f<=A)return t.copy(r);const g=f*c-l*A;if(g<=0&&c>=0&&A<=0)return a=c/(c-A),t.copy(i).addScaledVector(Vs,a);const m=u*A-f*h;if(m<=0&&h-u>=0&&f-A>=0)return Rd.subVectors(r,s),a=(h-u)/(h-u+(f-A)),t.copy(s).addScaledVector(Rd,a);const p=1/(m+g+d);return o=g*p,a=d*p,t.copy(i).addScaledVector(zs,o).addScaledVector(Vs,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}const yA={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Di={h:0,s:0,l:0},va={h:0,s:0,l:0};function xc(n,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?n+(e-n)*6*t:t<1/2?e:t<2/3?n+(e-n)*6*(2/3-t):n}class ye{constructor(e,t,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,i)}set(e,t,i){if(t===void 0&&i===void 0){const s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Bt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,lt.colorSpaceToWorking(this,t),this}setRGB(e,t,i,s=lt.workingColorSpace){return this.r=e,this.g=t,this.b=i,lt.colorSpaceToWorking(this,s),this}setHSL(e,t,i,s=lt.workingColorSpace){if(e=Ch(e,1),t=nt(t,0,1),i=nt(i,0,1),t===0)this.r=this.g=this.b=i;else{const r=i<=.5?i*(1+t):i+t-i*t,o=2*i-r;this.r=xc(o,r,e+1/3),this.g=xc(o,r,e),this.b=xc(o,r,e-1/3)}return lt.colorSpaceToWorking(this,s),this}setStyle(e,t=Bt){function i(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let r;const o=s[1],a=s[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:console.warn("THREE.Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){const r=s[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(o===6)return this.setHex(parseInt(r,16),t);console.warn("THREE.Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Bt){const i=yA[e.toLowerCase()];return i!==void 0?this.setHex(i,t):console.warn("THREE.Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Mi(e.r),this.g=Mi(e.g),this.b=Mi(e.b),this}copyLinearToSRGB(e){return this.r=br(e.r),this.g=br(e.g),this.b=br(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Bt){return lt.workingToColorSpace(Zt.copy(this),e),Math.round(nt(Zt.r*255,0,255))*65536+Math.round(nt(Zt.g*255,0,255))*256+Math.round(nt(Zt.b*255,0,255))}getHexString(e=Bt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=lt.workingColorSpace){lt.workingToColorSpace(Zt.copy(this),t);const i=Zt.r,s=Zt.g,r=Zt.b,o=Math.max(i,s,r),a=Math.min(i,s,r);let l,c;const u=(a+o)/2;if(a===o)l=0,c=0;else{const h=o-a;switch(c=u<=.5?h/(o+a):h/(2-o-a),o){case i:l=(s-r)/h+(s<r?6:0);break;case s:l=(r-i)/h+2;break;case r:l=(i-s)/h+4;break}l/=6}return e.h=l,e.s=c,e.l=u,e}getRGB(e,t=lt.workingColorSpace){return lt.workingToColorSpace(Zt.copy(this),t),e.r=Zt.r,e.g=Zt.g,e.b=Zt.b,e}getStyle(e=Bt){lt.workingToColorSpace(Zt.copy(this),e);const t=Zt.r,i=Zt.g,s=Zt.b;return e!==Bt?`color(${e} ${t.toFixed(3)} ${i.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(s*255)})`}offsetHSL(e,t,i){return this.getHSL(Di),this.setHSL(Di.h+e,Di.s+t,Di.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,i){return this.r=e.r+(t.r-e.r)*i,this.g=e.g+(t.g-e.g)*i,this.b=e.b+(t.b-e.b)*i,this}lerpHSL(e,t){this.getHSL(Di),e.getHSL(va);const i=To(Di.h,va.h,t),s=To(Di.s,va.s,t),r=To(Di.l,va.l,t);return this.setHSL(i,s,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,i=this.g,s=this.b,r=e.elements;return this.r=r[0]*t+r[3]*i+r[6]*s,this.g=r[1]*t+r[4]*i+r[7]*s,this.b=r[2]*t+r[5]*i+r[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Zt=new ye;ye.NAMES=yA;let p_=0;class An extends Qr{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:p_++}),this.uuid=Fn(),this.name="",this.type="Material",this.blending=_r,this.side=Ci,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Mu,this.blendDst=Su,this.blendEquation=as,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new ye(0,0,0),this.blendAlpha=0,this.depthFunc=Cr,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=md,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Us,this.stencilZFail=Us,this.stencilZPass=Us,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const i=e[t];if(i===void 0){console.warn(`THREE.Material: parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){console.warn(`THREE.Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(i):s&&s.isVector3&&i&&i.isVector3?s.copy(i):this[t]=i}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.shadowSide!==null&&(i.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),this.blending!==_r&&(i.blending=this.blending),this.side!==Ci&&(i.side=this.side),this.vertexColors===!0&&(i.vertexColors=!0),this.opacity<1&&(i.opacity=this.opacity),this.transparent===!0&&(i.transparent=!0),this.blendSrc!==Mu&&(i.blendSrc=this.blendSrc),this.blendDst!==Su&&(i.blendDst=this.blendDst),this.blendEquation!==as&&(i.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(i.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(i.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(i.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(i.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(i.blendAlpha=this.blendAlpha),this.depthFunc!==Cr&&(i.depthFunc=this.depthFunc),this.depthTest===!1&&(i.depthTest=this.depthTest),this.depthWrite===!1&&(i.depthWrite=this.depthWrite),this.colorWrite===!1&&(i.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(i.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==md&&(i.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(i.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(i.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Us&&(i.stencilFail=this.stencilFail),this.stencilZFail!==Us&&(i.stencilZFail=this.stencilZFail),this.stencilZPass!==Us&&(i.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(i.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(i.rotation=this.rotation),this.polygonOffset===!0&&(i.polygonOffset=!0),this.polygonOffsetFactor!==0&&(i.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(i.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(i.linewidth=this.linewidth),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.dithering===!0&&(i.dithering=!0),this.alphaTest>0&&(i.alphaTest=this.alphaTest),this.alphaHash===!0&&(i.alphaHash=!0),this.alphaToCoverage===!0&&(i.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(i.premultipliedAlpha=!0),this.forceSinglePass===!0&&(i.forceSinglePass=!0),this.wireframe===!0&&(i.wireframe=!0),this.wireframeLinewidth>1&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(i.flatShading=!0),this.visible===!1&&(i.visible=!1),this.toneMapped===!1&&(i.toneMapped=!1),this.fog===!1&&(i.fog=!1),Object.keys(this.userData).length>0&&(i.userData=this.userData);function s(r){const o=[];for(const a in r){const l=r[a];delete l.metadata,o.push(l)}return o}if(t){const r=s(e.textures),o=s(e.images);r.length>0&&(i.textures=r),o.length>0&&(i.images=o)}return i}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let i=null;if(t!==null){const s=t.length;i=new Array(s);for(let r=0;r!==s;++r)i[r]=t[r].clone()}return this.clippingPlanes=i,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}class dn extends An{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new ye(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new fn,this.combine=vh,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const Nt=new w,xa=new ce;let A_=0;class it{constructor(e,t,i=!1){if(Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:A_++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=i,this.usage=Ju,this.updateRanges=[],this.gpuType=sn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,i){e*=this.itemSize,i*=t.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[e+s]=t.array[i+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,i=this.count;t<i;t++)xa.fromBufferAttribute(this,t),xa.applyMatrix3(e),this.setXY(t,xa.x,xa.y);else if(this.itemSize===3)for(let t=0,i=this.count;t<i;t++)Nt.fromBufferAttribute(this,t),Nt.applyMatrix3(e),this.setXYZ(t,Nt.x,Nt.y,Nt.z);return this}applyMatrix4(e){for(let t=0,i=this.count;t<i;t++)Nt.fromBufferAttribute(this,t),Nt.applyMatrix4(e),this.setXYZ(t,Nt.x,Nt.y,Nt.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)Nt.fromBufferAttribute(this,t),Nt.applyNormalMatrix(e),this.setXYZ(t,Nt.x,Nt.y,Nt.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)Nt.fromBufferAttribute(this,t),Nt.transformDirection(e),this.setXYZ(t,Nt.x,Nt.y,Nt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let i=this.array[e*this.itemSize+t];return this.normalized&&(i=Hn(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=gt(i,this.array)),this.array[e*this.itemSize+t]=i,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=Hn(t,this.array)),t}setX(e,t){return this.normalized&&(t=gt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=Hn(t,this.array)),t}setY(e,t){return this.normalized&&(t=gt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=Hn(t,this.array)),t}setZ(e,t){return this.normalized&&(t=gt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=Hn(t,this.array)),t}setW(e,t){return this.normalized&&(t=gt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,i){return e*=this.itemSize,this.normalized&&(t=gt(t,this.array),i=gt(i,this.array)),this.array[e+0]=t,this.array[e+1]=i,this}setXYZ(e,t,i,s){return e*=this.itemSize,this.normalized&&(t=gt(t,this.array),i=gt(i,this.array),s=gt(s,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=s,this}setXYZW(e,t,i,s,r){return e*=this.itemSize,this.normalized&&(t=gt(t,this.array),i=gt(i,this.array),s=gt(s,this.array),r=gt(r,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=s,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Ju&&(e.usage=this.usage),e}}class MA extends it{constructor(e,t,i){super(new Uint16Array(e),t,i)}}class SA extends it{constructor(e,t,i){super(new Uint32Array(e),t,i)}}class pt extends it{constructor(e,t,i){super(new Float32Array(e),t,i)}}let m_=0;const In=new Qe,Ec=new vt,Ws=new w,vn=new oi,eo=new oi,Wt=new w;class mt extends Qr{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:m_++}),this.uuid=Fn(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(vA(e)?SA:MA)(e,1):this.index=e,this}setIndirect(e){return this.indirect=e,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,i=0){this.groups.push({start:e,count:t,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const i=this.attributes.normal;if(i!==void 0){const r=new ze().getNormalMatrix(e);i.applyNormalMatrix(r),i.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return In.makeRotationFromQuaternion(e),this.applyMatrix4(In),this}rotateX(e){return In.makeRotationX(e),this.applyMatrix4(In),this}rotateY(e){return In.makeRotationY(e),this.applyMatrix4(In),this}rotateZ(e){return In.makeRotationZ(e),this.applyMatrix4(In),this}translate(e,t,i){return In.makeTranslation(e,t,i),this.applyMatrix4(In),this}scale(e,t,i){return In.makeScale(e,t,i),this.applyMatrix4(In),this}lookAt(e){return Ec.lookAt(e),Ec.updateMatrix(),this.applyMatrix4(Ec.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Ws).negate(),this.translate(Ws.x,Ws.y,Ws.z),this}setFromPoints(e){const t=this.getAttribute("position");if(t===void 0){const i=[];for(let s=0,r=e.length;s<r;s++){const o=e[s];i.push(o.x,o.y,o.z||0)}this.setAttribute("position",new pt(i,3))}else{const i=Math.min(e.length,t.count);for(let s=0;s<i;s++){const r=e[s];t.setXYZ(s,r.x,r.y,r.z||0)}e.length>t.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new oi);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new w(-1/0,-1/0,-1/0),new w(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let i=0,s=t.length;i<s;i++){const r=t[i];vn.setFromBufferAttribute(r),this.morphTargetsRelative?(Wt.addVectors(this.boundingBox.min,vn.min),this.boundingBox.expandByPoint(Wt),Wt.addVectors(this.boundingBox.max,vn.max),this.boundingBox.expandByPoint(Wt)):(this.boundingBox.expandByPoint(vn.min),this.boundingBox.expandByPoint(vn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new ai);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new w,1/0);return}if(e){const i=this.boundingSphere.center;if(vn.setFromBufferAttribute(e),t)for(let r=0,o=t.length;r<o;r++){const a=t[r];eo.setFromBufferAttribute(a),this.morphTargetsRelative?(Wt.addVectors(vn.min,eo.min),vn.expandByPoint(Wt),Wt.addVectors(vn.max,eo.max),vn.expandByPoint(Wt)):(vn.expandByPoint(eo.min),vn.expandByPoint(eo.max))}vn.getCenter(i);let s=0;for(let r=0,o=e.count;r<o;r++)Wt.fromBufferAttribute(e,r),s=Math.max(s,i.distanceToSquared(Wt));if(t)for(let r=0,o=t.length;r<o;r++){const a=t[r],l=this.morphTargetsRelative;for(let c=0,u=a.count;c<u;c++)Wt.fromBufferAttribute(a,c),l&&(Ws.fromBufferAttribute(e,c),Wt.add(Ws)),s=Math.max(s,i.distanceToSquared(Wt))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const i=t.position,s=t.normal,r=t.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new it(new Float32Array(4*i.count),4));const o=this.getAttribute("tangent"),a=[],l=[];for(let L=0;L<i.count;L++)a[L]=new w,l[L]=new w;const c=new w,u=new w,h=new w,d=new ce,f=new ce,A=new ce,g=new w,m=new w;function p(L,y,b){c.fromBufferAttribute(i,L),u.fromBufferAttribute(i,y),h.fromBufferAttribute(i,b),d.fromBufferAttribute(r,L),f.fromBufferAttribute(r,y),A.fromBufferAttribute(r,b),u.sub(c),h.sub(c),f.sub(d),A.sub(d);const R=1/(f.x*A.y-A.x*f.y);isFinite(R)&&(g.copy(u).multiplyScalar(A.y).addScaledVector(h,-f.y).multiplyScalar(R),m.copy(h).multiplyScalar(f.x).addScaledVector(u,-A.x).multiplyScalar(R),a[L].add(g),a[y].add(g),a[b].add(g),l[L].add(m),l[y].add(m),l[b].add(m))}let E=this.groups;E.length===0&&(E=[{start:0,count:e.count}]);for(let L=0,y=E.length;L<y;++L){const b=E[L],R=b.start,U=b.count;for(let N=R,G=R+U;N<G;N+=3)p(e.getX(N+0),e.getX(N+1),e.getX(N+2))}const v=new w,_=new w,x=new w,S=new w;function I(L){x.fromBufferAttribute(s,L),S.copy(x);const y=a[L];v.copy(y),v.sub(x.multiplyScalar(x.dot(y))).normalize(),_.crossVectors(S,y);const R=_.dot(l[L])<0?-1:1;o.setXYZW(L,v.x,v.y,v.z,R)}for(let L=0,y=E.length;L<y;++L){const b=E[L],R=b.start,U=b.count;for(let N=R,G=R+U;N<G;N+=3)I(e.getX(N+0)),I(e.getX(N+1)),I(e.getX(N+2))}}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let i=this.getAttribute("normal");if(i===void 0)i=new it(new Float32Array(t.count*3),3),this.setAttribute("normal",i);else for(let d=0,f=i.count;d<f;d++)i.setXYZ(d,0,0,0);const s=new w,r=new w,o=new w,a=new w,l=new w,c=new w,u=new w,h=new w;if(e)for(let d=0,f=e.count;d<f;d+=3){const A=e.getX(d+0),g=e.getX(d+1),m=e.getX(d+2);s.fromBufferAttribute(t,A),r.fromBufferAttribute(t,g),o.fromBufferAttribute(t,m),u.subVectors(o,r),h.subVectors(s,r),u.cross(h),a.fromBufferAttribute(i,A),l.fromBufferAttribute(i,g),c.fromBufferAttribute(i,m),a.add(u),l.add(u),c.add(u),i.setXYZ(A,a.x,a.y,a.z),i.setXYZ(g,l.x,l.y,l.z),i.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,f=t.count;d<f;d+=3)s.fromBufferAttribute(t,d+0),r.fromBufferAttribute(t,d+1),o.fromBufferAttribute(t,d+2),u.subVectors(o,r),h.subVectors(s,r),u.cross(h),i.setXYZ(d+0,u.x,u.y,u.z),i.setXYZ(d+1,u.x,u.y,u.z),i.setXYZ(d+2,u.x,u.y,u.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,i=e.count;t<i;t++)Wt.fromBufferAttribute(e,t),Wt.normalize(),e.setXYZ(t,Wt.x,Wt.y,Wt.z)}toNonIndexed(){function e(a,l){const c=a.array,u=a.itemSize,h=a.normalized,d=new c.constructor(l.length*u);let f=0,A=0;for(let g=0,m=l.length;g<m;g++){a.isInterleavedBufferAttribute?f=l[g]*a.data.stride+a.offset:f=l[g]*u;for(let p=0;p<u;p++)d[A++]=c[f++]}return new it(d,u,h)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new mt,i=this.index.array,s=this.attributes;for(const a in s){const l=s[a],c=e(l,i);t.setAttribute(a,c)}const r=this.morphAttributes;for(const a in r){const l=[],c=r[a];for(let u=0,h=c.length;u<h;u++){const d=c[u],f=e(d,i);l.push(f)}t.morphAttributes[a]=l}t.morphTargetsRelative=this.morphTargetsRelative;const o=this.groups;for(let a=0,l=o.length;a<l;a++){const c=o[a];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const i=this.attributes;for(const l in i){const c=i[l];e.data.attributes[l]=c.toJSON(e.data)}const s={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],u=[];for(let h=0,d=c.length;h<d;h++){const f=c[h];u.push(f.toJSON(e.data))}u.length>0&&(s[l]=u,r=!0)}r&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);const o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));const a=this.boundingSphere;return a!==null&&(e.data.boundingSphere=a.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const i=e.index;i!==null&&this.setIndex(i.clone());const s=e.attributes;for(const c in s){const u=s[c];this.setAttribute(c,u.clone(t))}const r=e.morphAttributes;for(const c in r){const u=[],h=r[c];for(let d=0,f=h.length;d<f;d++)u.push(h[d].clone(t));this.morphAttributes[c]=u}this.morphTargetsRelative=e.morphTargetsRelative;const o=e.groups;for(let c=0,u=o.length;c<u;c++){const h=o[c];this.addGroup(h.start,h.count,h.materialIndex)}const a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const Bd=new Qe,Xi=new Gl,Ea=new ai,Ld=new w,ba=new w,ya=new w,Ma=new w,bc=new w,Sa=new w,Dd=new w,wa=new w;class Me extends vt{constructor(e=new mt,t=new dn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){const s=t[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){const a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(e,t){const i=this.geometry,s=i.attributes.position,r=i.morphAttributes.position,o=i.morphTargetsRelative;t.fromBufferAttribute(s,e);const a=this.morphTargetInfluences;if(r&&a){Sa.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const u=a[l],h=r[l];u!==0&&(bc.fromBufferAttribute(h,e),o?Sa.addScaledVector(bc,u):Sa.addScaledVector(bc.sub(t),u))}t.add(Sa)}return t}raycast(e,t){const i=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),Ea.copy(i.boundingSphere),Ea.applyMatrix4(r),Xi.copy(e.ray).recast(e.near),!(Ea.containsPoint(Xi.origin)===!1&&(Xi.intersectSphere(Ea,Ld)===null||Xi.origin.distanceToSquared(Ld)>(e.far-e.near)**2))&&(Bd.copy(r).invert(),Xi.copy(e.ray).applyMatrix4(Bd),!(i.boundingBox!==null&&Xi.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(e,t,Xi)))}_computeIntersections(e,t,i){let s;const r=this.geometry,o=this.material,a=r.index,l=r.attributes.position,c=r.attributes.uv,u=r.attributes.uv1,h=r.attributes.normal,d=r.groups,f=r.drawRange;if(a!==null)if(Array.isArray(o))for(let A=0,g=d.length;A<g;A++){const m=d[A],p=o[m.materialIndex],E=Math.max(m.start,f.start),v=Math.min(a.count,Math.min(m.start+m.count,f.start+f.count));for(let _=E,x=v;_<x;_+=3){const S=a.getX(_),I=a.getX(_+1),L=a.getX(_+2);s=Ca(this,p,e,i,c,u,h,S,I,L),s&&(s.faceIndex=Math.floor(_/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{const A=Math.max(0,f.start),g=Math.min(a.count,f.start+f.count);for(let m=A,p=g;m<p;m+=3){const E=a.getX(m),v=a.getX(m+1),_=a.getX(m+2);s=Ca(this,o,e,i,c,u,h,E,v,_),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}else if(l!==void 0)if(Array.isArray(o))for(let A=0,g=d.length;A<g;A++){const m=d[A],p=o[m.materialIndex],E=Math.max(m.start,f.start),v=Math.min(l.count,Math.min(m.start+m.count,f.start+f.count));for(let _=E,x=v;_<x;_+=3){const S=_,I=_+1,L=_+2;s=Ca(this,p,e,i,c,u,h,S,I,L),s&&(s.faceIndex=Math.floor(_/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{const A=Math.max(0,f.start),g=Math.min(l.count,f.start+f.count);for(let m=A,p=g;m<p;m+=3){const E=m,v=m+1,_=m+2;s=Ca(this,o,e,i,c,u,h,E,v,_),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}}}function g_(n,e,t,i,s,r,o,a){let l;if(e.side===Yt?l=i.intersectTriangle(o,r,s,!0,a):l=i.intersectTriangle(s,r,o,e.side===Ci,a),l===null)return null;wa.copy(a),wa.applyMatrix4(n.matrixWorld);const c=t.ray.origin.distanceTo(wa);return c<t.near||c>t.far?null:{distance:c,point:wa.clone(),object:n}}function Ca(n,e,t,i,s,r,o,a,l,c){n.getVertexPosition(a,ba),n.getVertexPosition(l,ya),n.getVertexPosition(c,Ma);const u=g_(n,e,t,i,ba,ya,Ma,Dd);if(u){const h=new w;Dn.getBarycoord(Dd,ba,ya,Ma,h),s&&(u.uv=Dn.getInterpolatedAttribute(s,a,l,c,h,new ce)),r&&(u.uv1=Dn.getInterpolatedAttribute(r,a,l,c,h,new ce)),o&&(u.normal=Dn.getInterpolatedAttribute(o,a,l,c,h,new w),u.normal.dot(i.direction)>0&&u.normal.multiplyScalar(-1));const d={a,b:l,c,normal:new w,materialIndex:0};Dn.getNormal(ba,ya,Ma,d.normal),u.face=d,u.barycoord=h}return u}class xn extends mt{constructor(e=1,t=1,i=1,s=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:s,heightSegments:r,depthSegments:o};const a=this;s=Math.floor(s),r=Math.floor(r),o=Math.floor(o);const l=[],c=[],u=[],h=[];let d=0,f=0;A("z","y","x",-1,-1,i,t,e,o,r,0),A("z","y","x",1,-1,i,t,-e,o,r,1),A("x","z","y",1,1,e,i,t,s,o,2),A("x","z","y",1,-1,e,i,-t,s,o,3),A("x","y","z",1,-1,e,t,i,s,r,4),A("x","y","z",-1,-1,e,t,-i,s,r,5),this.setIndex(l),this.setAttribute("position",new pt(c,3)),this.setAttribute("normal",new pt(u,3)),this.setAttribute("uv",new pt(h,2));function A(g,m,p,E,v,_,x,S,I,L,y){const b=_/I,R=x/L,U=_/2,N=x/2,G=S/2,V=I+1,P=L+1;let Y=0,H=0;const te=new w;for(let se=0;se<P;se++){const ae=se*R-N;for(let ve=0;ve<V;ve++){const Oe=ve*b-U;te[g]=Oe*E,te[m]=ae*v,te[p]=G,c.push(te.x,te.y,te.z),te[g]=0,te[m]=0,te[p]=S>0?1:-1,u.push(te.x,te.y,te.z),h.push(ve/I),h.push(1-se/L),Y+=1}}for(let se=0;se<L;se++)for(let ae=0;ae<I;ae++){const ve=d+ae+V*se,Oe=d+ae+V*(se+1),Ke=d+(ae+1)+V*(se+1),$e=d+(ae+1)+V*se;l.push(ve,Oe,$e),l.push(Oe,Ke,$e),H+=6}a.addGroup(f,H,y),f+=H,d+=Y}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new xn(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}function Lr(n){const e={};for(const t in n){e[t]={};for(const i in n[t]){const s=n[t][i];s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)?s.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][i]=null):e[t][i]=s.clone():Array.isArray(s)?e[t][i]=s.slice():e[t][i]=s}}return e}function cn(n){const e={};for(let t=0;t<n.length;t++){const i=Lr(n[t]);for(const s in i)e[s]=i[s]}return e}function __(n){const e=[];for(let t=0;t<n.length;t++)e.push(n[t].clone());return e}function wA(n){const e=n.getRenderTarget();return e===null?n.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:lt.workingColorSpace}const CA={clone:Lr,merge:cn};var v_=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,x_=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Mn extends An{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=v_,this.fragmentShader=x_,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Lr(e.uniforms),this.uniformsGroups=__(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const s in this.uniforms){const o=this.uniforms[s].value;o&&o.isTexture?t.uniforms[s]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[s]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[s]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[s]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[s]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[s]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[s]={type:"m4",value:o.toArray()}:t.uniforms[s]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const i={};for(const s in this.extensions)this.extensions[s]===!0&&(i[s]=!0);return Object.keys(i).length>0&&(t.extensions=i),t}}class IA extends vt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Qe,this.projectionMatrix=new Qe,this.projectionMatrixInverse=new Qe,this.coordinateSystem=ii,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const Pi=new w,Pd=new ce,Ud=new ce;class hn extends IA{constructor(e=50,t=1,i=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=i,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=Br*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(Io*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Br*2*Math.atan(Math.tan(Io*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,i){Pi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Pi.x,Pi.y).multiplyScalar(-e/Pi.z),Pi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(Pi.x,Pi.y).multiplyScalar(-e/Pi.z)}getViewSize(e,t){return this.getViewBounds(e,Pd,Ud),t.subVectors(Ud,Pd)}setViewOffset(e,t,i,s,r,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(Io*.5*this.fov)/this.zoom,i=2*t,s=this.aspect*i,r=-.5*s;const o=this.view;if(this.view!==null&&this.view.enabled){const l=o.fullWidth,c=o.fullHeight;r+=o.offsetX*s/l,t-=o.offsetY*i/c,s*=o.width/l,i*=o.height/c}const a=this.filmOffset;a!==0&&(r+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,t,t-i,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}const qs=-90,Xs=1;class E_ extends vt{constructor(e,t,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new hn(qs,Xs,e,t);s.layers=this.layers,this.add(s);const r=new hn(qs,Xs,e,t);r.layers=this.layers,this.add(r);const o=new hn(qs,Xs,e,t);o.layers=this.layers,this.add(o);const a=new hn(qs,Xs,e,t);a.layers=this.layers,this.add(a);const l=new hn(qs,Xs,e,t);l.layers=this.layers,this.add(l);const c=new hn(qs,Xs,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[i,s,r,o,a,l]=t;for(const c of t)this.remove(c);if(e===ii)i.up.set(0,1,0),i.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Sl)i.up.set(0,-1,0),i.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:i,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[r,o,a,l,c,u]=this.children,h=e.getRenderTarget(),d=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),A=e.xr.enabled;e.xr.enabled=!1;const g=i.texture.generateMipmaps;i.texture.generateMipmaps=!1,e.setRenderTarget(i,0,s),e.render(t,r),e.setRenderTarget(i,1,s),e.render(t,o),e.setRenderTarget(i,2,s),e.render(t,a),e.setRenderTarget(i,3,s),e.render(t,l),e.setRenderTarget(i,4,s),e.render(t,c),i.texture.generateMipmaps=g,e.setRenderTarget(i,5,s),e.render(t,u),e.setRenderTarget(h,d,f),e.xr.enabled=A,i.texture.needsPMREMUpdate=!0}}class TA extends Qt{constructor(e=[],t=xs,i,s,r,o,a,l,c,u){super(e,t,i,s,r,o,a,l,c,u),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class b_ extends ys{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const i={width:e,height:e,depth:1},s=[i,i,i,i,i,i];this.texture=new TA(s),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const i={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},s=new xn(5,5,5),r=new Mn({name:"CubemapFromEquirect",uniforms:Lr(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:Yt,blending:Qi});r.uniforms.tEquirect.value=t;const o=new Me(s,r),a=t.minFilter;return t.minFilter===Gn&&(t.minFilter=Jt),new E_(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t=!0,i=!0,s=!0){const r=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,i,s);e.setRenderTarget(r)}}class Ct extends vt{constructor(){super(),this.isGroup=!0,this.type="Group"}}const y_={type:"move"};class yc{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Ct,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Ct,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new w,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new w),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Ct,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new w,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new w),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const i of e.hand.values())this._getHandJoint(t,i)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,i){let s=null,r=null,o=null;const a=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){o=!0;for(const g of e.hand.values()){const m=t.getJointPose(g,i),p=this._getHandJoint(c,g);m!==null&&(p.matrix.fromArray(m.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=m.radius),p.visible=m!==null}const u=c.joints["index-finger-tip"],h=c.joints["thumb-tip"],d=u.position.distanceTo(h.position),f=.02,A=.005;c.inputState.pinching&&d>f+A?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&d<=f-A&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,i),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));a!==null&&(s=t.getPose(e.targetRaySpace,i),s===null&&r!==null&&(s=r),s!==null&&(a.matrix.fromArray(s.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,s.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(s.linearVelocity)):a.hasLinearVelocity=!1,s.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(s.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(y_)))}return a!==null&&(a.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const i=new Ct;i.matrixAutoUpdate=!1,i.visible=!1,e.joints[t.jointName]=i,e.add(i)}return e.joints[t.jointName]}}class Th{constructor(e,t=1,i=1e3){this.isFog=!0,this.name="",this.color=new ye(e),this.near=t,this.far=i}clone(){return new Th(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}}class M_ extends vt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new fn,this.environmentIntensity=1,this.environmentRotation=new fn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}}class zl{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=Ju,this.updateRanges=[],this.version=0,this.uuid=Fn()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,i){e*=this.stride,i*=t.stride;for(let s=0,r=this.stride;s<r;s++)this.array[e+s]=t.array[i+s];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Fn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);const t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),i=new this.constructor(t,this.stride);return i.setUsage(this.usage),i}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){return e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Fn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer))),{uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride}}}const an=new w;class Ms{constructor(e,t,i,s=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=i,this.normalized=s}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,i=this.data.count;t<i;t++)an.fromBufferAttribute(this,t),an.applyMatrix4(e),this.setXYZ(t,an.x,an.y,an.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)an.fromBufferAttribute(this,t),an.applyNormalMatrix(e),this.setXYZ(t,an.x,an.y,an.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)an.fromBufferAttribute(this,t),an.transformDirection(e),this.setXYZ(t,an.x,an.y,an.z);return this}getComponent(e,t){let i=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(i=Hn(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=gt(i,this.array)),this.data.array[e*this.data.stride+this.offset+t]=i,this}setX(e,t){return this.normalized&&(t=gt(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=gt(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=gt(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=gt(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=Hn(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=Hn(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=Hn(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=Hn(t,this.array)),t}setXY(e,t,i){return e=e*this.data.stride+this.offset,this.normalized&&(t=gt(t,this.array),i=gt(i,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=i,this}setXYZ(e,t,i,s){return e=e*this.data.stride+this.offset,this.normalized&&(t=gt(t,this.array),i=gt(i,this.array),s=gt(s,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=i,this.data.array[e+2]=s,this}setXYZW(e,t,i,s,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=gt(t,this.array),i=gt(i,this.array),s=gt(s,this.array),r=gt(r,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=i,this.data.array[e+2]=s,this.data.array[e+3]=r,this}clone(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let i=0;i<this.count;i++){const s=i*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[s+r])}return new it(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new Ms(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){console.log("THREE.InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");const t=[];for(let i=0;i<this.count;i++){const s=i*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[s+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}}class RA extends An{constructor(e){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new ye(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}let Ys;const to=new w,js=new w,Js=new w,Ks=new ce,no=new ce,BA=new Qe,Ia=new w,io=new w,Ta=new w,Fd=new ce,Mc=new ce,Nd=new ce;class S_ extends vt{constructor(e=new RA){if(super(),this.isSprite=!0,this.type="Sprite",Ys===void 0){Ys=new mt;const t=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),i=new zl(t,5);Ys.setIndex([0,1,2,0,2,3]),Ys.setAttribute("position",new Ms(i,3,0,!1)),Ys.setAttribute("uv",new Ms(i,2,3,!1))}this.geometry=Ys,this.material=e,this.center=new ce(.5,.5),this.count=1}raycast(e,t){e.camera===null&&console.error('THREE.Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),js.setFromMatrixScale(this.matrixWorld),BA.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),Js.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&js.multiplyScalar(-Js.z);const i=this.material.rotation;let s,r;i!==0&&(r=Math.cos(i),s=Math.sin(i));const o=this.center;Ra(Ia.set(-.5,-.5,0),Js,o,js,s,r),Ra(io.set(.5,-.5,0),Js,o,js,s,r),Ra(Ta.set(.5,.5,0),Js,o,js,s,r),Fd.set(0,0),Mc.set(1,0),Nd.set(1,1);let a=e.ray.intersectTriangle(Ia,io,Ta,!1,to);if(a===null&&(Ra(io.set(-.5,.5,0),Js,o,js,s,r),Mc.set(0,1),a=e.ray.intersectTriangle(Ia,Ta,io,!1,to),a===null))return;const l=e.ray.origin.distanceTo(to);l<e.near||l>e.far||t.push({distance:l,point:to.clone(),uv:Dn.getInterpolation(to,Ia,io,Ta,Fd,Mc,Nd,new ce),face:null,object:this})}copy(e,t){return super.copy(e,t),e.center!==void 0&&this.center.copy(e.center),this.material=e.material,this}}function Ra(n,e,t,i,s,r){Ks.subVectors(n,t).addScalar(.5).multiply(i),s!==void 0?(no.x=r*Ks.x-s*Ks.y,no.y=s*Ks.x+r*Ks.y):no.copy(Ks),n.copy(e),n.x+=no.x,n.y+=no.y,n.applyMatrix4(BA)}const Od=new w,kd=new ft,Qd=new ft,w_=new w,Hd=new Qe,Ba=new w,Sc=new ai,Gd=new Qe,wc=new Gl;class LA extends Me{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=dd,this.bindMatrix=new Qe,this.bindMatrixInverse=new Qe,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){const e=this.geometry;this.boundingBox===null&&(this.boundingBox=new oi),this.boundingBox.makeEmpty();const t=e.getAttribute("position");for(let i=0;i<t.count;i++)this.getVertexPosition(i,Ba),this.boundingBox.expandByPoint(Ba)}computeBoundingSphere(){const e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new ai),this.boundingSphere.makeEmpty();const t=e.getAttribute("position");for(let i=0;i<t.count;i++)this.getVertexPosition(i,Ba),this.boundingSphere.expandByPoint(Ba)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){const i=this.material,s=this.matrixWorld;i!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Sc.copy(this.boundingSphere),Sc.applyMatrix4(s),e.ray.intersectsSphere(Sc)!==!1&&(Gd.copy(s).invert(),wc.copy(e.ray).applyMatrix4(Gd),!(this.boundingBox!==null&&wc.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(e,t,wc)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){const e=new ft,t=this.geometry.attributes.skinWeight;for(let i=0,s=t.count;i<s;i++){e.fromBufferAttribute(t,i);const r=1/e.manhattanLength();r!==1/0?e.multiplyScalar(r):e.set(1,0,0,0),t.setXYZW(i,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===dd?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===S0?this.bindMatrixInverse.copy(this.bindMatrix).invert():console.warn("THREE.SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){const i=this.skeleton,s=this.geometry;kd.fromBufferAttribute(s.attributes.skinIndex,e),Qd.fromBufferAttribute(s.attributes.skinWeight,e),Od.copy(t).applyMatrix4(this.bindMatrix),t.set(0,0,0);for(let r=0;r<4;r++){const o=Qd.getComponent(r);if(o!==0){const a=kd.getComponent(r);Hd.multiplyMatrices(i.bones[a].matrixWorld,i.boneInverses[a]),t.addScaledVector(w_.copy(Od).applyMatrix4(Hd),o)}}return t.applyMatrix4(this.bindMatrixInverse)}}class DA extends vt{constructor(){super(),this.isBone=!0,this.type="Bone"}}class Vl extends Qt{constructor(e=null,t=1,i=1,s,r,o,a,l,c=Gt,u=Gt,h,d){super(null,o,a,l,c,u,s,r,h,d),this.isDataTexture=!0,this.image={data:e,width:t,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const zd=new Qe,C_=new Qe;class Hr{constructor(e=[],t=[]){this.uuid=Fn(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){const e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(e.length*16),t.length===0)this.calculateInverses();else if(e.length!==t.length){console.warn("THREE.Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let i=0,s=this.bones.length;i<s;i++)this.boneInverses.push(new Qe)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){const i=new Qe;this.bones[e]&&i.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(i)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){const i=this.bones[e];i&&i.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){const i=this.bones[e];i&&(i.parent&&i.parent.isBone?(i.matrix.copy(i.parent.matrixWorld).invert(),i.matrix.multiply(i.matrixWorld)):i.matrix.copy(i.matrixWorld),i.matrix.decompose(i.position,i.quaternion,i.scale))}}update(){const e=this.bones,t=this.boneInverses,i=this.boneMatrices,s=this.boneTexture;for(let r=0,o=e.length;r<o;r++){const a=e[r]?e[r].matrixWorld:C_;zd.multiplyMatrices(a,t[r]),zd.toArray(i,r*16)}s!==null&&(s.needsUpdate=!0)}clone(){return new Hr(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(this.bones.length*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);const t=new Float32Array(e*e*4);t.set(this.boneMatrices);const i=new Vl(t,e,e,Ht,sn);return i.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=i,this}getBoneByName(e){for(let t=0,i=this.bones.length;t<i;t++){const s=this.bones[t];if(s.name===e)return s}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let i=0,s=e.bones.length;i<s;i++){const r=e.bones[i];let o=t[r];o===void 0&&(console.warn("THREE.Skeleton: No bone found with UUID:",r),o=new DA),this.bones.push(o),this.boneInverses.push(new Qe().fromArray(e.boneInverses[i]))}return this.init(),this}toJSON(){const e={metadata:{version:4.7,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;const t=this.bones,i=this.boneInverses;for(let s=0,r=t.length;s<r;s++){const o=t[s];e.bones.push(o.uuid);const a=i[s];e.boneInverses.push(a.toArray())}return e}}class Ku extends it{constructor(e,t,i,s=1){super(e,t,i),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){const e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}}const Zs=new Qe,Vd=new Qe,La=[],Wd=new oi,I_=new Qe,so=new Me,ro=new ai;class Zu extends Me{constructor(e,t,i){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new Ku(new Float32Array(i*16),16),this.instanceColor=null,this.morphTexture=null,this.count=i,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<i;s++)this.setMatrixAt(s,I_)}computeBoundingBox(){const e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new oi),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,Zs),Wd.copy(e.boundingBox).applyMatrix4(Zs),this.boundingBox.union(Wd)}computeBoundingSphere(){const e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new ai),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,Zs),ro.copy(e.boundingSphere).applyMatrix4(Zs),this.boundingSphere.union(ro)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){const i=t.morphTargetInfluences,s=this.morphTexture.source.data.data,r=i.length+1,o=e*r+1;for(let a=0;a<i.length;a++)i[a]=s[o+a]}raycast(e,t){const i=this.matrixWorld,s=this.count;if(so.geometry=this.geometry,so.material=this.material,so.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),ro.copy(this.boundingSphere),ro.applyMatrix4(i),e.ray.intersectsSphere(ro)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,Zs),Vd.multiplyMatrices(i,Zs),so.matrixWorld=Vd,so.raycast(e,La);for(let o=0,a=La.length;o<a;o++){const l=La[o];l.instanceId=r,l.object=this,t.push(l)}La.length=0}}setColorAt(e,t){this.instanceColor===null&&(this.instanceColor=new Ku(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3)}setMatrixAt(e,t){t.toArray(this.instanceMatrix.array,e*16)}setMorphAt(e,t){const i=t.morphTargetInfluences,s=i.length+1;this.morphTexture===null&&(this.morphTexture=new Vl(new Float32Array(s*this.count),s,this.count,Oi,sn));const r=this.morphTexture.source.data.data;let o=0;for(let c=0;c<i.length;c++)o+=i[c];const a=this.geometry.morphTargetsRelative?1:1-o,l=s*e;r[l]=a,r.set(i,l+1)}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}}const Cc=new w,T_=new w,R_=new ze;class rs{constructor(e=new w(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,i,s){return this.normal.set(e,t,i),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,i){const s=Cc.subVectors(i,t).cross(T_.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t){const i=e.delta(Cc),s=this.normal.dot(i);if(s===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const r=-(e.start.dot(this.normal)+this.constant)/s;return r<0||r>1?null:t.copy(e.start).addScaledVector(i,r)}intersectsLine(e){const t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&i>0||i<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const i=t||R_.getNormalMatrix(e),s=this.coplanarPoint(Cc).applyMatrix4(e),r=this.normal.applyMatrix3(i).normalize();return this.constant=-s.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Yi=new ai,B_=new ce(.5,.5),Da=new w;class Rh{constructor(e=new rs,t=new rs,i=new rs,s=new rs,r=new rs,o=new rs){this.planes=[e,t,i,s,r,o]}set(e,t,i,s,r,o){const a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(i),a[3].copy(s),a[4].copy(r),a[5].copy(o),this}copy(e){const t=this.planes;for(let i=0;i<6;i++)t[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e,t=ii,i=!1){const s=this.planes,r=e.elements,o=r[0],a=r[1],l=r[2],c=r[3],u=r[4],h=r[5],d=r[6],f=r[7],A=r[8],g=r[9],m=r[10],p=r[11],E=r[12],v=r[13],_=r[14],x=r[15];if(s[0].setComponents(c-o,f-u,p-A,x-E).normalize(),s[1].setComponents(c+o,f+u,p+A,x+E).normalize(),s[2].setComponents(c+a,f+h,p+g,x+v).normalize(),s[3].setComponents(c-a,f-h,p-g,x-v).normalize(),i)s[4].setComponents(l,d,m,_).normalize(),s[5].setComponents(c-l,f-d,p-m,x-_).normalize();else if(s[4].setComponents(c-l,f-d,p-m,x-_).normalize(),t===ii)s[5].setComponents(c+l,f+d,p+m,x+_).normalize();else if(t===Sl)s[5].setComponents(l,d,m,_).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),Yi.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),Yi.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(Yi)}intersectsSprite(e){Yi.center.set(0,0,0);const t=B_.distanceTo(e.center);return Yi.radius=.7071067811865476+t,Yi.applyMatrix4(e.matrixWorld),this.intersectsSphere(Yi)}intersectsSphere(e){const t=this.planes,i=e.center,s=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(i)<s)return!1;return!0}intersectsBox(e){const t=this.planes;for(let i=0;i<6;i++){const s=t[i];if(Da.x=s.normal.x>0?e.max.x:e.min.x,Da.y=s.normal.y>0?e.max.y:e.min.y,Da.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(Da)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class Ts extends An{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new ye(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}}const wl=new w,Cl=new w,qd=new Qe,oo=new Gl,Pa=new ai,Ic=new w,Xd=new w;class Wl extends vt{constructor(e=new mt,t=new Ts){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,i=[0];for(let s=1,r=t.count;s<r;s++)wl.fromBufferAttribute(t,s-1),Cl.fromBufferAttribute(t,s),i[s]=i[s-1],i[s]+=wl.distanceTo(Cl);e.setAttribute("lineDistance",new pt(i,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(e,t){const i=this.geometry,s=this.matrixWorld,r=e.params.Line.threshold,o=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),Pa.copy(i.boundingSphere),Pa.applyMatrix4(s),Pa.radius+=r,e.ray.intersectsSphere(Pa)===!1)return;qd.copy(s).invert(),oo.copy(e.ray).applyMatrix4(qd);const a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=this.isLineSegments?2:1,u=i.index,d=i.attributes.position;if(u!==null){const f=Math.max(0,o.start),A=Math.min(u.count,o.start+o.count);for(let g=f,m=A-1;g<m;g+=c){const p=u.getX(g),E=u.getX(g+1),v=Ua(this,e,oo,l,p,E,g);v&&t.push(v)}if(this.isLineLoop){const g=u.getX(A-1),m=u.getX(f),p=Ua(this,e,oo,l,g,m,A-1);p&&t.push(p)}}else{const f=Math.max(0,o.start),A=Math.min(d.count,o.start+o.count);for(let g=f,m=A-1;g<m;g+=c){const p=Ua(this,e,oo,l,g,g+1,g);p&&t.push(p)}if(this.isLineLoop){const g=Ua(this,e,oo,l,A-1,f,A-1);g&&t.push(g)}}}updateMorphTargets(){const t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){const s=t[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){const a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}}function Ua(n,e,t,i,s,r,o){const a=n.geometry.attributes.position;if(wl.fromBufferAttribute(a,s),Cl.fromBufferAttribute(a,r),t.distanceSqToSegment(wl,Cl,Ic,Xd)>i)return;Ic.applyMatrix4(n.matrixWorld);const c=e.ray.origin.distanceTo(Ic);if(!(c<e.near||c>e.far))return{distance:c,point:Xd.clone().applyMatrix4(n.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:n}}const Yd=new w,jd=new w;class ia extends Wl{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,i=[];for(let s=0,r=t.count;s<r;s+=2)Yd.fromBufferAttribute(t,s),jd.fromBufferAttribute(t,s+1),i[s]=s===0?0:i[s-1],i[s+1]=i[s]+Yd.distanceTo(jd);e.setAttribute("lineDistance",new pt(i,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class L_ extends Wl{constructor(e,t){super(e,t),this.isLineLoop=!0,this.type="LineLoop"}}class PA extends An{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new ye(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}const Jd=new Qe,$u=new Gl,Fa=new ai,Na=new w;class UA extends vt{constructor(e=new mt,t=new PA){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){const i=this.geometry,s=this.matrixWorld,r=e.params.Points.threshold,o=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),Fa.copy(i.boundingSphere),Fa.applyMatrix4(s),Fa.radius+=r,e.ray.intersectsSphere(Fa)===!1)return;Jd.copy(s).invert(),$u.copy(e.ray).applyMatrix4(Jd);const a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=i.index,h=i.attributes.position;if(c!==null){const d=Math.max(0,o.start),f=Math.min(c.count,o.start+o.count);for(let A=d,g=f;A<g;A++){const m=c.getX(A);Na.fromBufferAttribute(h,m),Kd(Na,m,l,s,e,t,this)}}else{const d=Math.max(0,o.start),f=Math.min(h.count,o.start+o.count);for(let A=d,g=f;A<g;A++)Na.fromBufferAttribute(h,A),Kd(Na,A,l,s,e,t,this)}}updateMorphTargets(){const t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){const s=t[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){const a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}}function Kd(n,e,t,i,s,r,o){const a=$u.distanceSqToPoint(n);if(a<t){const l=new w;$u.closestPointToPoint(n,l),l.applyMatrix4(i);const c=s.ray.origin.distanceTo(l);if(c<s.near||c>s.far)return;r.push({distance:c,distanceToRay:Math.sqrt(a),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:o})}}class ql extends Qt{constructor(e,t,i,s,r,o,a,l,c,u,h,d){super(null,o,a,l,c,u,s,r,h,d),this.isCompressedTexture=!0,this.image={width:t,height:i},this.mipmaps=e,this.flipY=!1,this.generateMipmaps=!1}}class D_ extends ql{constructor(e,t,i,s,r,o){super(e,t,i,r,o),this.isCompressedArrayTexture=!0,this.image.depth=s,this.wrapR=bi,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class P_ extends ql{constructor(e,t,i){super(void 0,e[0].width,e[0].height,t,i,xs),this.isCompressedCubeTexture=!0,this.isCubeTexture=!0,this.image=e}}class Gr extends Qt{constructor(e,t,i,s,r,o,a,l,c){super(e,t,i,s,r,o,a,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class FA extends Qt{constructor(e,t,i=bs,s,r,o,a=Gt,l=Gt,c,u=Qo,h=1){if(u!==Qo&&u!==Ho)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const d={width:e,height:t,depth:h};super(d,s,r,o,a,l,u,i,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Ih(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}class NA extends Qt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class jo extends mt{constructor(e=1,t=1,i=4,s=8,r=1){super(),this.type="CapsuleGeometry",this.parameters={radius:e,height:t,capSegments:i,radialSegments:s,heightSegments:r},t=Math.max(0,t),i=Math.max(1,Math.floor(i)),s=Math.max(3,Math.floor(s)),r=Math.max(1,Math.floor(r));const o=[],a=[],l=[],c=[],u=t/2,h=Math.PI/2*e,d=t,f=2*h+d,A=i*2+r,g=s+1,m=new w,p=new w;for(let E=0;E<=A;E++){let v=0,_=0,x=0,S=0;if(E<=i){const y=E/i,b=y*Math.PI/2;_=-u-e*Math.cos(b),x=e*Math.sin(b),S=-e*Math.cos(b),v=y*h}else if(E<=i+r){const y=(E-i)/r;_=-u+y*t,x=e,S=0,v=h+y*d}else{const y=(E-i-r)/i,b=y*Math.PI/2;_=u+e*Math.sin(b),x=e*Math.cos(b),S=e*Math.sin(b),v=h+d+y*h}const I=Math.max(0,Math.min(1,v/f));let L=0;E===0?L=.5/s:E===A&&(L=-.5/s);for(let y=0;y<=s;y++){const b=y/s,R=b*Math.PI*2,U=Math.sin(R),N=Math.cos(R);p.x=-x*N,p.y=_,p.z=x*U,a.push(p.x,p.y,p.z),m.set(-x*N,S,x*U),m.normalize(),l.push(m.x,m.y,m.z),c.push(b+L,I)}if(E>0){const y=(E-1)*g;for(let b=0;b<s;b++){const R=y+b,U=y+b+1,N=E*g+b,G=E*g+b+1;o.push(R,U,N),o.push(U,G,N)}}}this.setIndex(o),this.setAttribute("position",new pt(a,3)),this.setAttribute("normal",new pt(l,3)),this.setAttribute("uv",new pt(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new jo(e.radius,e.height,e.capSegments,e.radialSegments,e.heightSegments)}}class Bh extends mt{constructor(e=1,t=32,i=0,s=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:i,thetaLength:s},t=Math.max(3,t);const r=[],o=[],a=[],l=[],c=new w,u=new ce;o.push(0,0,0),a.push(0,0,1),l.push(.5,.5);for(let h=0,d=3;h<=t;h++,d+=3){const f=i+h/t*s;c.x=e*Math.cos(f),c.y=e*Math.sin(f),o.push(c.x,c.y,c.z),a.push(0,0,1),u.x=(o[d]/e+1)/2,u.y=(o[d+1]/e+1)/2,l.push(u.x,u.y)}for(let h=1;h<=t;h++)r.push(h,h+1,0);this.setIndex(r),this.setAttribute("position",new pt(o,3)),this.setAttribute("normal",new pt(a,3)),this.setAttribute("uv",new pt(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Bh(e.radius,e.segments,e.thetaStart,e.thetaLength)}}class si extends mt{constructor(e=1,t=1,i=1,s=32,r=1,o=!1,a=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:i,radialSegments:s,heightSegments:r,openEnded:o,thetaStart:a,thetaLength:l};const c=this;s=Math.floor(s),r=Math.floor(r);const u=[],h=[],d=[],f=[];let A=0;const g=[],m=i/2;let p=0;E(),o===!1&&(e>0&&v(!0),t>0&&v(!1)),this.setIndex(u),this.setAttribute("position",new pt(h,3)),this.setAttribute("normal",new pt(d,3)),this.setAttribute("uv",new pt(f,2));function E(){const _=new w,x=new w;let S=0;const I=(t-e)/i;for(let L=0;L<=r;L++){const y=[],b=L/r,R=b*(t-e)+e;for(let U=0;U<=s;U++){const N=U/s,G=N*l+a,V=Math.sin(G),P=Math.cos(G);x.x=R*V,x.y=-b*i+m,x.z=R*P,h.push(x.x,x.y,x.z),_.set(V,I,P).normalize(),d.push(_.x,_.y,_.z),f.push(N,1-b),y.push(A++)}g.push(y)}for(let L=0;L<s;L++)for(let y=0;y<r;y++){const b=g[y][L],R=g[y+1][L],U=g[y+1][L+1],N=g[y][L+1];(e>0||y!==0)&&(u.push(b,R,N),S+=3),(t>0||y!==r-1)&&(u.push(R,U,N),S+=3)}c.addGroup(p,S,0),p+=S}function v(_){const x=A,S=new ce,I=new w;let L=0;const y=_===!0?e:t,b=_===!0?1:-1;for(let U=1;U<=s;U++)h.push(0,m*b,0),d.push(0,b,0),f.push(.5,.5),A++;const R=A;for(let U=0;U<=s;U++){const G=U/s*l+a,V=Math.cos(G),P=Math.sin(G);I.x=y*P,I.y=m*b,I.z=y*V,h.push(I.x,I.y,I.z),d.push(0,b,0),S.x=V*.5+.5,S.y=P*.5*b+.5,f.push(S.x,S.y),A++}for(let U=0;U<s;U++){const N=x+U,G=R+U;_===!0?u.push(G,G+1,N):u.push(G+1,G,N),L+=3}c.addGroup(p,L,_===!0?1:2),p+=L}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new si(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class Lh extends si{constructor(e=1,t=1,i=32,s=1,r=!1,o=0,a=Math.PI*2){super(0,e,t,i,s,r,o,a),this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:i,heightSegments:s,openEnded:r,thetaStart:o,thetaLength:a}}static fromJSON(e){return new Lh(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class li{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){console.warn("THREE.Curve: .getPoint() not implemented.")}getPointAt(e,t){const i=this.getUtoTmapping(e);return this.getPoint(i,t)}getPoints(e=5){const t=[];for(let i=0;i<=e;i++)t.push(this.getPoint(i/e));return t}getSpacedPoints(e=5){const t=[];for(let i=0;i<=e;i++)t.push(this.getPointAt(i/e));return t}getLength(){const e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const t=[];let i,s=this.getPoint(0),r=0;t.push(0);for(let o=1;o<=e;o++)i=this.getPoint(o/e),r+=i.distanceTo(s),t.push(r),s=i;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t=null){const i=this.getLengths();let s=0;const r=i.length;let o;t?o=t:o=e*i[r-1];let a=0,l=r-1,c;for(;a<=l;)if(s=Math.floor(a+(l-a)/2),c=i[s]-o,c<0)a=s+1;else if(c>0)l=s-1;else{l=s;break}if(s=l,i[s]===o)return s/(r-1);const u=i[s],d=i[s+1]-u,f=(o-u)/d;return(s+f)/(r-1)}getTangent(e,t){let s=e-1e-4,r=e+1e-4;s<0&&(s=0),r>1&&(r=1);const o=this.getPoint(s),a=this.getPoint(r),l=t||(o.isVector2?new ce:new w);return l.copy(a).sub(o).normalize(),l}getTangentAt(e,t){const i=this.getUtoTmapping(e);return this.getTangent(i,t)}computeFrenetFrames(e,t=!1){const i=new w,s=[],r=[],o=[],a=new w,l=new Qe;for(let f=0;f<=e;f++){const A=f/e;s[f]=this.getTangentAt(A,new w)}r[0]=new w,o[0]=new w;let c=Number.MAX_VALUE;const u=Math.abs(s[0].x),h=Math.abs(s[0].y),d=Math.abs(s[0].z);u<=c&&(c=u,i.set(1,0,0)),h<=c&&(c=h,i.set(0,1,0)),d<=c&&i.set(0,0,1),a.crossVectors(s[0],i).normalize(),r[0].crossVectors(s[0],a),o[0].crossVectors(s[0],r[0]);for(let f=1;f<=e;f++){if(r[f]=r[f-1].clone(),o[f]=o[f-1].clone(),a.crossVectors(s[f-1],s[f]),a.length()>Number.EPSILON){a.normalize();const A=Math.acos(nt(s[f-1].dot(s[f]),-1,1));r[f].applyMatrix4(l.makeRotationAxis(a,A))}o[f].crossVectors(s[f],r[f])}if(t===!0){let f=Math.acos(nt(r[0].dot(r[e]),-1,1));f/=e,s[0].dot(a.crossVectors(r[0],r[e]))>0&&(f=-f);for(let A=1;A<=e;A++)r[A].applyMatrix4(l.makeRotationAxis(s[A],f*A)),o[A].crossVectors(s[A],r[A])}return{tangents:s,normals:r,binormals:o}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){const e={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}}class Dh extends li{constructor(e=0,t=0,i=1,s=1,r=0,o=Math.PI*2,a=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=i,this.yRadius=s,this.aStartAngle=r,this.aEndAngle=o,this.aClockwise=a,this.aRotation=l}getPoint(e,t=new ce){const i=t,s=Math.PI*2;let r=this.aEndAngle-this.aStartAngle;const o=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=s;for(;r>s;)r-=s;r<Number.EPSILON&&(o?r=0:r=s),this.aClockwise===!0&&!o&&(r===s?r=-s:r=r-s);const a=this.aStartAngle+e*r;let l=this.aX+this.xRadius*Math.cos(a),c=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){const u=Math.cos(this.aRotation),h=Math.sin(this.aRotation),d=l-this.aX,f=c-this.aY;l=d*u-f*h+this.aX,c=d*h+f*u+this.aY}return i.set(l,c)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){const e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}}class U_ extends Dh{constructor(e,t,i,s,r,o){super(e,t,i,i,s,r,o),this.isArcCurve=!0,this.type="ArcCurve"}}function Ph(){let n=0,e=0,t=0,i=0;function s(r,o,a,l){n=r,e=a,t=-3*r+3*o-2*a-l,i=2*r-2*o+a+l}return{initCatmullRom:function(r,o,a,l,c){s(o,a,c*(a-r),c*(l-o))},initNonuniformCatmullRom:function(r,o,a,l,c,u,h){let d=(o-r)/c-(a-r)/(c+u)+(a-o)/u,f=(a-o)/u-(l-o)/(u+h)+(l-a)/h;d*=u,f*=u,s(o,a,d,f)},calc:function(r){const o=r*r,a=o*r;return n+e*r+t*o+i*a}}}const Oa=new w,Tc=new Ph,Rc=new Ph,Bc=new Ph;class OA extends li{constructor(e=[],t=!1,i="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=i,this.tension=s}getPoint(e,t=new w){const i=t,s=this.points,r=s.length,o=(r-(this.closed?0:1))*e;let a=Math.floor(o),l=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/r)+1)*r:l===0&&a===r-1&&(a=r-2,l=1);let c,u;this.closed||a>0?c=s[(a-1)%r]:(Oa.subVectors(s[0],s[1]).add(s[0]),c=Oa);const h=s[a%r],d=s[(a+1)%r];if(this.closed||a+2<r?u=s[(a+2)%r]:(Oa.subVectors(s[r-1],s[r-2]).add(s[r-1]),u=Oa),this.curveType==="centripetal"||this.curveType==="chordal"){const f=this.curveType==="chordal"?.5:.25;let A=Math.pow(c.distanceToSquared(h),f),g=Math.pow(h.distanceToSquared(d),f),m=Math.pow(d.distanceToSquared(u),f);g<1e-4&&(g=1),A<1e-4&&(A=g),m<1e-4&&(m=g),Tc.initNonuniformCatmullRom(c.x,h.x,d.x,u.x,A,g,m),Rc.initNonuniformCatmullRom(c.y,h.y,d.y,u.y,A,g,m),Bc.initNonuniformCatmullRom(c.z,h.z,d.z,u.z,A,g,m)}else this.curveType==="catmullrom"&&(Tc.initCatmullRom(c.x,h.x,d.x,u.x,this.tension),Rc.initCatmullRom(c.y,h.y,d.y,u.y,this.tension),Bc.initCatmullRom(c.z,h.z,d.z,u.z,this.tension));return i.set(Tc.calc(l),Rc.calc(l),Bc.calc(l)),i}copy(e){super.copy(e),this.points=[];for(let t=0,i=e.points.length;t<i;t++){const s=e.points[t];this.points.push(s.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){const e=super.toJSON();e.points=[];for(let t=0,i=this.points.length;t<i;t++){const s=this.points[t];e.points.push(s.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,i=e.points.length;t<i;t++){const s=e.points[t];this.points.push(new w().fromArray(s))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}}function Zd(n,e,t,i,s){const r=(i-e)*.5,o=(s-t)*.5,a=n*n,l=n*a;return(2*t-2*i+r+o)*l+(-3*t+3*i-2*r-o)*a+r*n+t}function F_(n,e){const t=1-n;return t*t*e}function N_(n,e){return 2*(1-n)*n*e}function O_(n,e){return n*n*e}function Ro(n,e,t,i){return F_(n,e)+N_(n,t)+O_(n,i)}function k_(n,e){const t=1-n;return t*t*t*e}function Q_(n,e){const t=1-n;return 3*t*t*n*e}function H_(n,e){return 3*(1-n)*n*n*e}function G_(n,e){return n*n*n*e}function Bo(n,e,t,i,s){return k_(n,e)+Q_(n,t)+H_(n,i)+G_(n,s)}class kA extends li{constructor(e=new ce,t=new ce,i=new ce,s=new ce){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=i,this.v3=s}getPoint(e,t=new ce){const i=t,s=this.v0,r=this.v1,o=this.v2,a=this.v3;return i.set(Bo(e,s.x,r.x,o.x,a.x),Bo(e,s.y,r.y,o.y,a.y)),i}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}class z_ extends li{constructor(e=new w,t=new w,i=new w,s=new w){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=i,this.v3=s}getPoint(e,t=new w){const i=t,s=this.v0,r=this.v1,o=this.v2,a=this.v3;return i.set(Bo(e,s.x,r.x,o.x,a.x),Bo(e,s.y,r.y,o.y,a.y),Bo(e,s.z,r.z,o.z,a.z)),i}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}}class QA extends li{constructor(e=new ce,t=new ce){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new ce){const i=t;return e===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(e).add(this.v1)),i}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new ce){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class V_ extends li{constructor(e=new w,t=new w){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new w){const i=t;return e===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(e).add(this.v1)),i}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new w){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class HA extends li{constructor(e=new ce,t=new ce,i=new ce){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=i}getPoint(e,t=new ce){const i=t,s=this.v0,r=this.v1,o=this.v2;return i.set(Ro(e,s.x,r.x,o.x),Ro(e,s.y,r.y,o.y)),i}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class GA extends li{constructor(e=new w,t=new w,i=new w){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=i}getPoint(e,t=new w){const i=t,s=this.v0,r=this.v1,o=this.v2;return i.set(Ro(e,s.x,r.x,o.x),Ro(e,s.y,r.y,o.y),Ro(e,s.z,r.z,o.z)),i}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){const e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}}class zA extends li{constructor(e=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new ce){const i=t,s=this.points,r=(s.length-1)*e,o=Math.floor(r),a=r-o,l=s[o===0?o:o-1],c=s[o],u=s[o>s.length-2?s.length-1:o+1],h=s[o>s.length-3?s.length-1:o+2];return i.set(Zd(a,l.x,c.x,u.x,h.x),Zd(a,l.y,c.y,u.y,h.y)),i}copy(e){super.copy(e),this.points=[];for(let t=0,i=e.points.length;t<i;t++){const s=e.points[t];this.points.push(s.clone())}return this}toJSON(){const e=super.toJSON();e.points=[];for(let t=0,i=this.points.length;t<i;t++){const s=this.points[t];e.points.push(s.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,i=e.points.length;t<i;t++){const s=e.points[t];this.points.push(new ce().fromArray(s))}return this}}var Il=Object.freeze({__proto__:null,ArcCurve:U_,CatmullRomCurve3:OA,CubicBezierCurve:kA,CubicBezierCurve3:z_,EllipseCurve:Dh,LineCurve:QA,LineCurve3:V_,QuadraticBezierCurve:HA,QuadraticBezierCurve3:GA,SplineCurve:zA});class W_ extends li{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){const e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);if(!e.equals(t)){const i=e.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new Il[i](t,e))}return this}getPoint(e,t){const i=e*this.getLength(),s=this.getCurveLengths();let r=0;for(;r<s.length;){if(s[r]>=i){const o=s[r]-i,a=this.curves[r],l=a.getLength(),c=l===0?0:1-o/l;return a.getPointAt(c,t)}r++}return null}getLength(){const e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;const e=[];let t=0;for(let i=0,s=this.curves.length;i<s;i++)t+=this.curves[i].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){const t=[];for(let i=0;i<=e;i++)t.push(this.getPoint(i/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){const t=[];let i;for(let s=0,r=this.curves;s<r.length;s++){const o=r[s],a=o.isEllipseCurve?e*2:o.isLineCurve||o.isLineCurve3?1:o.isSplineCurve?e*o.points.length:e,l=o.getPoints(a);for(let c=0;c<l.length;c++){const u=l[c];i&&i.equals(u)||(t.push(u),i=u)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,i=e.curves.length;t<i;t++){const s=e.curves[t];this.curves.push(s.clone())}return this.autoClose=e.autoClose,this}toJSON(){const e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,i=this.curves.length;t<i;t++){const s=this.curves[t];e.curves.push(s.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,i=e.curves.length;t<i;t++){const s=e.curves[t];this.curves.push(new Il[s.type]().fromJSON(s))}return this}}class $d extends W_{constructor(e){super(),this.type="Path",this.currentPoint=new ce,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,i=e.length;t<i;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){const i=new QA(this.currentPoint.clone(),new ce(e,t));return this.curves.push(i),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,i,s){const r=new HA(this.currentPoint.clone(),new ce(e,t),new ce(i,s));return this.curves.push(r),this.currentPoint.set(i,s),this}bezierCurveTo(e,t,i,s,r,o){const a=new kA(this.currentPoint.clone(),new ce(e,t),new ce(i,s),new ce(r,o));return this.curves.push(a),this.currentPoint.set(r,o),this}splineThru(e){const t=[this.currentPoint.clone()].concat(e),i=new zA(t);return this.curves.push(i),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,i,s,r,o){const a=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(e+a,t+l,i,s,r,o),this}absarc(e,t,i,s,r,o){return this.absellipse(e,t,i,i,s,r,o),this}ellipse(e,t,i,s,r,o,a,l){const c=this.currentPoint.x,u=this.currentPoint.y;return this.absellipse(e+c,t+u,i,s,r,o,a,l),this}absellipse(e,t,i,s,r,o,a,l){const c=new Dh(e,t,i,s,r,o,a,l);if(this.curves.length>0){const h=c.getPoint(0);h.equals(this.currentPoint)||this.lineTo(h.x,h.y)}this.curves.push(c);const u=c.getPoint(1);return this.currentPoint.copy(u),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){const e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}}class VA extends $d{constructor(e){super(e),this.uuid=Fn(),this.type="Shape",this.holes=[]}getPointsHoles(e){const t=[];for(let i=0,s=this.holes.length;i<s;i++)t[i]=this.holes[i].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,i=e.holes.length;t<i;t++){const s=e.holes[t];this.holes.push(s.clone())}return this}toJSON(){const e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,i=this.holes.length;t<i;t++){const s=this.holes[t];e.holes.push(s.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,i=e.holes.length;t<i;t++){const s=e.holes[t];this.holes.push(new $d().fromJSON(s))}return this}}function q_(n,e,t=2){const i=e&&e.length,s=i?e[0]*t:n.length;let r=WA(n,0,s,t,!0);const o=[];if(!r||r.next===r.prev)return o;let a,l,c;if(i&&(r=K_(n,e,r,t)),n.length>80*t){a=1/0,l=1/0;let u=-1/0,h=-1/0;for(let d=t;d<s;d+=t){const f=n[d],A=n[d+1];f<a&&(a=f),A<l&&(l=A),f>u&&(u=f),A>h&&(h=A)}c=Math.max(u-a,h-l),c=c!==0?32767/c:0}return Jo(r,o,t,a,l,c,0),o}function WA(n,e,t,i,s){let r;if(s===lv(n,e,t,i)>0)for(let o=e;o<t;o+=i)r=ef(o/i|0,n[o],n[o+1],r);else for(let o=t-i;o>=e;o-=i)r=ef(o/i|0,n[o],n[o+1],r);return r&&Dr(r,r.next)&&(Zo(r),r=r.next),r}function Ss(n,e){if(!n)return n;e||(e=n);let t=n,i;do if(i=!1,!t.steiner&&(Dr(t,t.next)||Ut(t.prev,t,t.next)===0)){if(Zo(t),t=e=t.prev,t===t.next)break;i=!0}else t=t.next;while(i||t!==e);return e}function Jo(n,e,t,i,s,r,o){if(!n)return;!o&&r&&nv(n,i,s,r);let a=n;for(;n.prev!==n.next;){const l=n.prev,c=n.next;if(r?Y_(n,i,s,r):X_(n)){e.push(l.i,n.i,c.i),Zo(n),n=c.next,a=c.next;continue}if(n=c,n===a){o?o===1?(n=j_(Ss(n),e),Jo(n,e,t,i,s,r,2)):o===2&&J_(n,e,t,i,s,r):Jo(Ss(n),e,t,i,s,r,1);break}}}function X_(n){const e=n.prev,t=n,i=n.next;if(Ut(e,t,i)>=0)return!1;const s=e.x,r=t.x,o=i.x,a=e.y,l=t.y,c=i.y,u=Math.min(s,r,o),h=Math.min(a,l,c),d=Math.max(s,r,o),f=Math.max(a,l,c);let A=i.next;for(;A!==e;){if(A.x>=u&&A.x<=d&&A.y>=h&&A.y<=f&&bo(s,a,r,l,o,c,A.x,A.y)&&Ut(A.prev,A,A.next)>=0)return!1;A=A.next}return!0}function Y_(n,e,t,i){const s=n.prev,r=n,o=n.next;if(Ut(s,r,o)>=0)return!1;const a=s.x,l=r.x,c=o.x,u=s.y,h=r.y,d=o.y,f=Math.min(a,l,c),A=Math.min(u,h,d),g=Math.max(a,l,c),m=Math.max(u,h,d),p=eh(f,A,e,t,i),E=eh(g,m,e,t,i);let v=n.prevZ,_=n.nextZ;for(;v&&v.z>=p&&_&&_.z<=E;){if(v.x>=f&&v.x<=g&&v.y>=A&&v.y<=m&&v!==s&&v!==o&&bo(a,u,l,h,c,d,v.x,v.y)&&Ut(v.prev,v,v.next)>=0||(v=v.prevZ,_.x>=f&&_.x<=g&&_.y>=A&&_.y<=m&&_!==s&&_!==o&&bo(a,u,l,h,c,d,_.x,_.y)&&Ut(_.prev,_,_.next)>=0))return!1;_=_.nextZ}for(;v&&v.z>=p;){if(v.x>=f&&v.x<=g&&v.y>=A&&v.y<=m&&v!==s&&v!==o&&bo(a,u,l,h,c,d,v.x,v.y)&&Ut(v.prev,v,v.next)>=0)return!1;v=v.prevZ}for(;_&&_.z<=E;){if(_.x>=f&&_.x<=g&&_.y>=A&&_.y<=m&&_!==s&&_!==o&&bo(a,u,l,h,c,d,_.x,_.y)&&Ut(_.prev,_,_.next)>=0)return!1;_=_.nextZ}return!0}function j_(n,e){let t=n;do{const i=t.prev,s=t.next.next;!Dr(i,s)&&XA(i,t,t.next,s)&&Ko(i,s)&&Ko(s,i)&&(e.push(i.i,t.i,s.i),Zo(t),Zo(t.next),t=n=s),t=t.next}while(t!==n);return Ss(t)}function J_(n,e,t,i,s,r){let o=n;do{let a=o.next.next;for(;a!==o.prev;){if(o.i!==a.i&&rv(o,a)){let l=YA(o,a);o=Ss(o,o.next),l=Ss(l,l.next),Jo(o,e,t,i,s,r,0),Jo(l,e,t,i,s,r,0);return}a=a.next}o=o.next}while(o!==n)}function K_(n,e,t,i){const s=[];for(let r=0,o=e.length;r<o;r++){const a=e[r]*i,l=r<o-1?e[r+1]*i:n.length,c=WA(n,a,l,i,!1);c===c.next&&(c.steiner=!0),s.push(sv(c))}s.sort(Z_);for(let r=0;r<s.length;r++)t=$_(s[r],t);return t}function Z_(n,e){let t=n.x-e.x;if(t===0&&(t=n.y-e.y,t===0)){const i=(n.next.y-n.y)/(n.next.x-n.x),s=(e.next.y-e.y)/(e.next.x-e.x);t=i-s}return t}function $_(n,e){const t=ev(n,e);if(!t)return e;const i=YA(t,n);return Ss(i,i.next),Ss(t,t.next)}function ev(n,e){let t=e;const i=n.x,s=n.y;let r=-1/0,o;if(Dr(n,t))return t;do{if(Dr(n,t.next))return t.next;if(s<=t.y&&s>=t.next.y&&t.next.y!==t.y){const h=t.x+(s-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(h<=i&&h>r&&(r=h,o=t.x<t.next.x?t:t.next,h===i))return o}t=t.next}while(t!==e);if(!o)return null;const a=o,l=o.x,c=o.y;let u=1/0;t=o;do{if(i>=t.x&&t.x>=l&&i!==t.x&&qA(s<c?i:r,s,l,c,s<c?r:i,s,t.x,t.y)){const h=Math.abs(s-t.y)/(i-t.x);Ko(t,n)&&(h<u||h===u&&(t.x>o.x||t.x===o.x&&tv(o,t)))&&(o=t,u=h)}t=t.next}while(t!==a);return o}function tv(n,e){return Ut(n.prev,n,e.prev)<0&&Ut(e.next,n,n.next)<0}function nv(n,e,t,i){let s=n;do s.z===0&&(s.z=eh(s.x,s.y,e,t,i)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==n);s.prevZ.nextZ=null,s.prevZ=null,iv(s)}function iv(n){let e,t=1;do{let i=n,s;n=null;let r=null;for(e=0;i;){e++;let o=i,a=0;for(let c=0;c<t&&(a++,o=o.nextZ,!!o);c++);let l=t;for(;a>0||l>0&&o;)a!==0&&(l===0||!o||i.z<=o.z)?(s=i,i=i.nextZ,a--):(s=o,o=o.nextZ,l--),r?r.nextZ=s:n=s,s.prevZ=r,r=s;i=o}r.nextZ=null,t*=2}while(e>1);return n}function eh(n,e,t,i,s){return n=(n-t)*s|0,e=(e-i)*s|0,n=(n|n<<8)&16711935,n=(n|n<<4)&252645135,n=(n|n<<2)&858993459,n=(n|n<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,n|e<<1}function sv(n){let e=n,t=n;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==n);return t}function qA(n,e,t,i,s,r,o,a){return(s-o)*(e-a)>=(n-o)*(r-a)&&(n-o)*(i-a)>=(t-o)*(e-a)&&(t-o)*(r-a)>=(s-o)*(i-a)}function bo(n,e,t,i,s,r,o,a){return!(n===o&&e===a)&&qA(n,e,t,i,s,r,o,a)}function rv(n,e){return n.next.i!==e.i&&n.prev.i!==e.i&&!ov(n,e)&&(Ko(n,e)&&Ko(e,n)&&av(n,e)&&(Ut(n.prev,n,e.prev)||Ut(n,e.prev,e))||Dr(n,e)&&Ut(n.prev,n,n.next)>0&&Ut(e.prev,e,e.next)>0)}function Ut(n,e,t){return(e.y-n.y)*(t.x-e.x)-(e.x-n.x)*(t.y-e.y)}function Dr(n,e){return n.x===e.x&&n.y===e.y}function XA(n,e,t,i){const s=Qa(Ut(n,e,t)),r=Qa(Ut(n,e,i)),o=Qa(Ut(t,i,n)),a=Qa(Ut(t,i,e));return!!(s!==r&&o!==a||s===0&&ka(n,t,e)||r===0&&ka(n,i,e)||o===0&&ka(t,n,i)||a===0&&ka(t,e,i))}function ka(n,e,t){return e.x<=Math.max(n.x,t.x)&&e.x>=Math.min(n.x,t.x)&&e.y<=Math.max(n.y,t.y)&&e.y>=Math.min(n.y,t.y)}function Qa(n){return n>0?1:n<0?-1:0}function ov(n,e){let t=n;do{if(t.i!==n.i&&t.next.i!==n.i&&t.i!==e.i&&t.next.i!==e.i&&XA(t,t.next,n,e))return!0;t=t.next}while(t!==n);return!1}function Ko(n,e){return Ut(n.prev,n,n.next)<0?Ut(n,e,n.next)>=0&&Ut(n,n.prev,e)>=0:Ut(n,e,n.prev)<0||Ut(n,n.next,e)<0}function av(n,e){let t=n,i=!1;const s=(n.x+e.x)/2,r=(n.y+e.y)/2;do t.y>r!=t.next.y>r&&t.next.y!==t.y&&s<(t.next.x-t.x)*(r-t.y)/(t.next.y-t.y)+t.x&&(i=!i),t=t.next;while(t!==n);return i}function YA(n,e){const t=th(n.i,n.x,n.y),i=th(e.i,e.x,e.y),s=n.next,r=e.prev;return n.next=e,e.prev=n,t.next=s,s.prev=t,i.next=t,t.prev=i,r.next=i,i.prev=r,i}function ef(n,e,t,i){const s=th(n,e,t);return i?(s.next=i.next,s.prev=i,i.next.prev=s,i.next=s):(s.prev=s,s.next=s),s}function Zo(n){n.next.prev=n.prev,n.prev.next=n.next,n.prevZ&&(n.prevZ.nextZ=n.nextZ),n.nextZ&&(n.nextZ.prevZ=n.prevZ)}function th(n,e,t){return{i:n,x:e,y:t,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function lv(n,e,t,i){let s=0;for(let r=e,o=t-i;r<t;r+=i)s+=(n[o]-n[r])*(n[r+1]+n[o+1]),o=r;return s}class cv{static triangulate(e,t,i=2){return q_(e,t,i)}}class fr{static area(e){const t=e.length;let i=0;for(let s=t-1,r=0;r<t;s=r++)i+=e[s].x*e[r].y-e[r].x*e[s].y;return i*.5}static isClockWise(e){return fr.area(e)<0}static triangulateShape(e,t){const i=[],s=[],r=[];tf(e),nf(i,e);let o=e.length;t.forEach(tf);for(let l=0;l<t.length;l++)s.push(o),o+=t[l].length,nf(i,t[l]);const a=cv.triangulate(i,s);for(let l=0;l<a.length;l+=3)r.push(a.slice(l,l+3));return r}}function tf(n){const e=n.length;e>2&&n[e-1].equals(n[0])&&n.pop()}function nf(n,e){for(let t=0;t<e.length;t++)n.push(e[t].x),n.push(e[t].y)}class Uh extends mt{constructor(e=new VA([new ce(.5,.5),new ce(-.5,.5),new ce(-.5,-.5),new ce(.5,-.5)]),t={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:e,options:t},e=Array.isArray(e)?e:[e];const i=this,s=[],r=[];for(let a=0,l=e.length;a<l;a++){const c=e[a];o(c)}this.setAttribute("position",new pt(s,3)),this.setAttribute("uv",new pt(r,2)),this.computeVertexNormals();function o(a){const l=[],c=t.curveSegments!==void 0?t.curveSegments:12,u=t.steps!==void 0?t.steps:1,h=t.depth!==void 0?t.depth:1;let d=t.bevelEnabled!==void 0?t.bevelEnabled:!0,f=t.bevelThickness!==void 0?t.bevelThickness:.2,A=t.bevelSize!==void 0?t.bevelSize:f-.1,g=t.bevelOffset!==void 0?t.bevelOffset:0,m=t.bevelSegments!==void 0?t.bevelSegments:3;const p=t.extrudePath,E=t.UVGenerator!==void 0?t.UVGenerator:uv;let v,_=!1,x,S,I,L;p&&(v=p.getSpacedPoints(u),_=!0,d=!1,x=p.computeFrenetFrames(u,!1),S=new w,I=new w,L=new w),d||(m=0,f=0,A=0,g=0);const y=a.extractPoints(c);let b=y.shape;const R=y.holes;if(!fr.isClockWise(b)){b=b.reverse();for(let $=0,j=R.length;$<j;$++){const q=R[$];fr.isClockWise(q)&&(R[$]=q.reverse())}}function N($){const q=10000000000000001e-36;let Z=$[0];for(let Ae=1;Ae<=$.length;Ae++){const oe=Ae%$.length,pe=$[oe],We=pe.x-Z.x,Xe=pe.y-Z.y,T=We*We+Xe*Xe,M=Math.max(Math.abs(pe.x),Math.abs(pe.y),Math.abs(Z.x),Math.abs(Z.y)),k=q*M*M;if(T<=k){$.splice(oe,1),Ae--;continue}Z=pe}}N(b),R.forEach(N);const G=R.length,V=b;for(let $=0;$<G;$++){const j=R[$];b=b.concat(j)}function P($,j,q){return j||console.error("THREE.ExtrudeGeometry: vec does not exist"),$.clone().addScaledVector(j,q)}const Y=b.length;function H($,j,q){let Z,Ae,oe;const pe=$.x-j.x,We=$.y-j.y,Xe=q.x-$.x,T=q.y-$.y,M=pe*pe+We*We,k=pe*T-We*Xe;if(Math.abs(k)>Number.EPSILON){const X=Math.sqrt(M),ie=Math.sqrt(Xe*Xe+T*T),J=j.x-We/X,De=j.y+pe/X,he=q.x-T/ie,Be=q.y+Xe/ie,Te=((he-J)*T-(Be-De)*Xe)/(pe*T-We*Xe);Z=J+pe*Te-$.x,Ae=De+We*Te-$.y;const ue=Z*Z+Ae*Ae;if(ue<=2)return new ce(Z,Ae);oe=Math.sqrt(ue/2)}else{let X=!1;pe>Number.EPSILON?Xe>Number.EPSILON&&(X=!0):pe<-Number.EPSILON?Xe<-Number.EPSILON&&(X=!0):Math.sign(We)===Math.sign(T)&&(X=!0),X?(Z=-We,Ae=pe,oe=Math.sqrt(M)):(Z=pe,Ae=We,oe=Math.sqrt(M/2))}return new ce(Z/oe,Ae/oe)}const te=[];for(let $=0,j=V.length,q=j-1,Z=$+1;$<j;$++,q++,Z++)q===j&&(q=0),Z===j&&(Z=0),te[$]=H(V[$],V[q],V[Z]);const se=[];let ae,ve=te.concat();for(let $=0,j=G;$<j;$++){const q=R[$];ae=[];for(let Z=0,Ae=q.length,oe=Ae-1,pe=Z+1;Z<Ae;Z++,oe++,pe++)oe===Ae&&(oe=0),pe===Ae&&(pe=0),ae[Z]=H(q[Z],q[oe],q[pe]);se.push(ae),ve=ve.concat(ae)}let Oe;if(m===0)Oe=fr.triangulateShape(V,R);else{const $=[],j=[];for(let q=0;q<m;q++){const Z=q/m,Ae=f*Math.cos(Z*Math.PI/2),oe=A*Math.sin(Z*Math.PI/2)+g;for(let pe=0,We=V.length;pe<We;pe++){const Xe=P(V[pe],te[pe],oe);Le(Xe.x,Xe.y,-Ae),Z===0&&$.push(Xe)}for(let pe=0,We=G;pe<We;pe++){const Xe=R[pe];ae=se[pe];const T=[];for(let M=0,k=Xe.length;M<k;M++){const X=P(Xe[M],ae[M],oe);Le(X.x,X.y,-Ae),Z===0&&T.push(X)}Z===0&&j.push(T)}}Oe=fr.triangulateShape($,j)}const Ke=Oe.length,$e=A+g;for(let $=0;$<Y;$++){const j=d?P(b[$],ve[$],$e):b[$];_?(I.copy(x.normals[0]).multiplyScalar(j.x),S.copy(x.binormals[0]).multiplyScalar(j.y),L.copy(v[0]).add(I).add(S),Le(L.x,L.y,L.z)):Le(j.x,j.y,0)}for(let $=1;$<=u;$++)for(let j=0;j<Y;j++){const q=d?P(b[j],ve[j],$e):b[j];_?(I.copy(x.normals[$]).multiplyScalar(q.x),S.copy(x.binormals[$]).multiplyScalar(q.y),L.copy(v[$]).add(I).add(S),Le(L.x,L.y,L.z)):Le(q.x,q.y,h/u*$)}for(let $=m-1;$>=0;$--){const j=$/m,q=f*Math.cos(j*Math.PI/2),Z=A*Math.sin(j*Math.PI/2)+g;for(let Ae=0,oe=V.length;Ae<oe;Ae++){const pe=P(V[Ae],te[Ae],Z);Le(pe.x,pe.y,h+q)}for(let Ae=0,oe=R.length;Ae<oe;Ae++){const pe=R[Ae];ae=se[Ae];for(let We=0,Xe=pe.length;We<Xe;We++){const T=P(pe[We],ae[We],Z);_?Le(T.x,T.y+v[u-1].y,v[u-1].x+q):Le(T.x,T.y,h+q)}}}K(),ne();function K(){const $=s.length/3;if(d){let j=0,q=Y*j;for(let Z=0;Z<Ke;Z++){const Ae=Oe[Z];Se(Ae[2]+q,Ae[1]+q,Ae[0]+q)}j=u+m*2,q=Y*j;for(let Z=0;Z<Ke;Z++){const Ae=Oe[Z];Se(Ae[0]+q,Ae[1]+q,Ae[2]+q)}}else{for(let j=0;j<Ke;j++){const q=Oe[j];Se(q[2],q[1],q[0])}for(let j=0;j<Ke;j++){const q=Oe[j];Se(q[0]+Y*u,q[1]+Y*u,q[2]+Y*u)}}i.addGroup($,s.length/3-$,0)}function ne(){const $=s.length/3;let j=0;be(V,j),j+=V.length;for(let q=0,Z=R.length;q<Z;q++){const Ae=R[q];be(Ae,j),j+=Ae.length}i.addGroup($,s.length/3-$,1)}function be($,j){let q=$.length;for(;--q>=0;){const Z=q;let Ae=q-1;Ae<0&&(Ae=$.length-1);for(let oe=0,pe=u+m*2;oe<pe;oe++){const We=Y*oe,Xe=Y*(oe+1),T=j+Z+We,M=j+Ae+We,k=j+Ae+Xe,X=j+Z+Xe;re(T,M,k,X)}}}function Le($,j,q){l.push($),l.push(j),l.push(q)}function Se($,j,q){Ie($),Ie(j),Ie(q);const Z=s.length/3,Ae=E.generateTopUV(i,s,Z-3,Z-2,Z-1);B(Ae[0]),B(Ae[1]),B(Ae[2])}function re($,j,q,Z){Ie($),Ie(j),Ie(Z),Ie(j),Ie(q),Ie(Z);const Ae=s.length/3,oe=E.generateSideWallUV(i,s,Ae-6,Ae-3,Ae-2,Ae-1);B(oe[0]),B(oe[1]),B(oe[3]),B(oe[1]),B(oe[2]),B(oe[3])}function Ie($){s.push(l[$*3+0]),s.push(l[$*3+1]),s.push(l[$*3+2])}function B($){r.push($.x),r.push($.y)}}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){const e=super.toJSON(),t=this.parameters.shapes,i=this.parameters.options;return hv(t,i,e)}static fromJSON(e,t){const i=[];for(let r=0,o=e.shapes.length;r<o;r++){const a=t[e.shapes[r]];i.push(a)}const s=e.options.extrudePath;return s!==void 0&&(e.options.extrudePath=new Il[s.type]().fromJSON(s)),new Uh(i,e.options)}}const uv={generateTopUV:function(n,e,t,i,s){const r=e[t*3],o=e[t*3+1],a=e[i*3],l=e[i*3+1],c=e[s*3],u=e[s*3+1];return[new ce(r,o),new ce(a,l),new ce(c,u)]},generateSideWallUV:function(n,e,t,i,s,r){const o=e[t*3],a=e[t*3+1],l=e[t*3+2],c=e[i*3],u=e[i*3+1],h=e[i*3+2],d=e[s*3],f=e[s*3+1],A=e[s*3+2],g=e[r*3],m=e[r*3+1],p=e[r*3+2];return Math.abs(a-u)<Math.abs(o-c)?[new ce(o,1-l),new ce(c,1-h),new ce(d,1-A),new ce(g,1-p)]:[new ce(a,1-l),new ce(u,1-h),new ce(f,1-A),new ce(m,1-p)]}};function hv(n,e,t){if(t.shapes=[],Array.isArray(n))for(let i=0,s=n.length;i<s;i++){const r=n[i];t.shapes.push(r.uuid)}else t.shapes.push(n.uuid);return t.options=Object.assign({},e),e.extrudePath!==void 0&&(t.options.extrudePath=e.extrudePath.toJSON()),t}class En extends mt{constructor(e=1,t=1,i=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:s};const r=e/2,o=t/2,a=Math.floor(i),l=Math.floor(s),c=a+1,u=l+1,h=e/a,d=t/l,f=[],A=[],g=[],m=[];for(let p=0;p<u;p++){const E=p*d-o;for(let v=0;v<c;v++){const _=v*h-r;A.push(_,-E,0),g.push(0,0,1),m.push(v/a),m.push(1-p/l)}}for(let p=0;p<l;p++)for(let E=0;E<a;E++){const v=E+c*p,_=E+c*(p+1),x=E+1+c*(p+1),S=E+1+c*p;f.push(v,_,S),f.push(_,x,S)}this.setIndex(f),this.setAttribute("position",new pt(A,3)),this.setAttribute("normal",new pt(g,3)),this.setAttribute("uv",new pt(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new En(e.width,e.height,e.widthSegments,e.heightSegments)}}class Xt extends mt{constructor(e=1,t=32,i=16,s=0,r=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:i,phiStart:s,phiLength:r,thetaStart:o,thetaLength:a},t=Math.max(3,Math.floor(t)),i=Math.max(2,Math.floor(i));const l=Math.min(o+a,Math.PI);let c=0;const u=[],h=new w,d=new w,f=[],A=[],g=[],m=[];for(let p=0;p<=i;p++){const E=[],v=p/i;let _=0;p===0&&o===0?_=.5/t:p===i&&l===Math.PI&&(_=-.5/t);for(let x=0;x<=t;x++){const S=x/t;h.x=-e*Math.cos(s+S*r)*Math.sin(o+v*a),h.y=e*Math.cos(o+v*a),h.z=e*Math.sin(s+S*r)*Math.sin(o+v*a),A.push(h.x,h.y,h.z),d.copy(h).normalize(),g.push(d.x,d.y,d.z),m.push(S+_,1-v),E.push(c++)}u.push(E)}for(let p=0;p<i;p++)for(let E=0;E<t;E++){const v=u[p][E+1],_=u[p][E],x=u[p+1][E],S=u[p+1][E+1];(p!==0||o>0)&&f.push(v,_,S),(p!==i-1||l<Math.PI)&&f.push(_,x,S)}this.setIndex(f),this.setAttribute("position",new pt(A,3)),this.setAttribute("normal",new pt(g,3)),this.setAttribute("uv",new pt(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Xt(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}}class yr extends mt{constructor(e=1,t=.4,i=12,s=48,r=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:i,tubularSegments:s,arc:r},i=Math.floor(i),s=Math.floor(s);const o=[],a=[],l=[],c=[],u=new w,h=new w,d=new w;for(let f=0;f<=i;f++)for(let A=0;A<=s;A++){const g=A/s*r,m=f/i*Math.PI*2;h.x=(e+t*Math.cos(m))*Math.cos(g),h.y=(e+t*Math.cos(m))*Math.sin(g),h.z=t*Math.sin(m),a.push(h.x,h.y,h.z),u.x=e*Math.cos(g),u.y=e*Math.sin(g),d.subVectors(h,u).normalize(),l.push(d.x,d.y,d.z),c.push(A/s),c.push(f/i)}for(let f=1;f<=i;f++)for(let A=1;A<=s;A++){const g=(s+1)*f+A-1,m=(s+1)*(f-1)+A-1,p=(s+1)*(f-1)+A,E=(s+1)*f+A;o.push(g,m,E),o.push(m,p,E)}this.setIndex(o),this.setAttribute("position",new pt(a,3)),this.setAttribute("normal",new pt(l,3)),this.setAttribute("uv",new pt(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new yr(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc)}}class Fh extends mt{constructor(e=new GA(new w(-1,-1,0),new w(-1,1,0),new w(1,1,0)),t=64,i=1,s=8,r=!1){super(),this.type="TubeGeometry",this.parameters={path:e,tubularSegments:t,radius:i,radialSegments:s,closed:r};const o=e.computeFrenetFrames(t,r);this.tangents=o.tangents,this.normals=o.normals,this.binormals=o.binormals;const a=new w,l=new w,c=new ce;let u=new w;const h=[],d=[],f=[],A=[];g(),this.setIndex(A),this.setAttribute("position",new pt(h,3)),this.setAttribute("normal",new pt(d,3)),this.setAttribute("uv",new pt(f,2));function g(){for(let v=0;v<t;v++)m(v);m(r===!1?t:0),E(),p()}function m(v){u=e.getPointAt(v/t,u);const _=o.normals[v],x=o.binormals[v];for(let S=0;S<=s;S++){const I=S/s*Math.PI*2,L=Math.sin(I),y=-Math.cos(I);l.x=y*_.x+L*x.x,l.y=y*_.y+L*x.y,l.z=y*_.z+L*x.z,l.normalize(),d.push(l.x,l.y,l.z),a.x=u.x+i*l.x,a.y=u.y+i*l.y,a.z=u.z+i*l.z,h.push(a.x,a.y,a.z)}}function p(){for(let v=1;v<=t;v++)for(let _=1;_<=s;_++){const x=(s+1)*(v-1)+(_-1),S=(s+1)*v+(_-1),I=(s+1)*v+_,L=(s+1)*(v-1)+_;A.push(x,S,L),A.push(S,I,L)}}function E(){for(let v=0;v<=t;v++)for(let _=0;_<=s;_++)c.x=v/t,c.y=_/s,f.push(c.x,c.y)}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){const e=super.toJSON();return e.path=this.parameters.path.toJSON(),e}static fromJSON(e){return new Fh(new Il[e.path.type]().fromJSON(e.path),e.tubularSegments,e.radius,e.radialSegments,e.closed)}}class Nh extends An{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new ye(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ye(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=na,this.normalScale=new ce(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new fn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class ci extends Nh{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new ce(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return nt(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new ye(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new ye(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new ye(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}}class Oh extends An{constructor(e){super(),this.isMeshToonMaterial=!0,this.defines={TOON:""},this.type="MeshToonMaterial",this.color=new ye(16777215),this.map=null,this.gradientMap=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ye(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=na,this.normalScale=new ce(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.alphaMap=null,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.gradientMap=e.gradientMap,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.alphaMap=e.alphaMap,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}class $s extends An{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new ye(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new ye(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=na,this.normalScale=new ce(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new fn,this.combine=vh,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class dv extends An{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=I0,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class fv extends An{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}function Ha(n,e){return!n||n.constructor===e?n:typeof e.BYTES_PER_ELEMENT=="number"?new e(n):Array.prototype.slice.call(n)}function pv(n){return ArrayBuffer.isView(n)&&!(n instanceof DataView)}function Av(n){function e(s,r){return n[s]-n[r]}const t=n.length,i=new Array(t);for(let s=0;s!==t;++s)i[s]=s;return i.sort(e),i}function sf(n,e,t){const i=n.length,s=new n.constructor(i);for(let r=0,o=0;o!==i;++r){const a=t[r]*e;for(let l=0;l!==e;++l)s[o++]=n[a+l]}return s}function jA(n,e,t,i){let s=1,r=n[0];for(;r!==void 0&&r[i]===void 0;)r=n[s++];if(r===void 0)return;let o=r[i];if(o!==void 0)if(Array.isArray(o))do o=r[i],o!==void 0&&(e.push(r.time),t.push(...o)),r=n[s++];while(r!==void 0);else if(o.toArray!==void 0)do o=r[i],o!==void 0&&(e.push(r.time),o.toArray(t,t.length)),r=n[s++];while(r!==void 0);else do o=r[i],o!==void 0&&(e.push(r.time),t.push(o)),r=n[s++];while(r!==void 0)}class sa{constructor(e,t,i,s){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new t.constructor(i),this.sampleValues=t,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(e){const t=this.parameterPositions;let i=this._cachedIndex,s=t[i],r=t[i-1];n:{e:{let o;t:{i:if(!(e<s)){for(let a=i+2;;){if(s===void 0){if(e<r)break i;return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===a)break;if(r=s,s=t[++i],e<s)break e}o=t.length;break t}if(!(e>=r)){const a=t[1];e<a&&(i=2,r=a);for(let l=i-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===l)break;if(s=r,r=t[--i-1],e>=r)break e}o=i,i=0;break t}break n}for(;i<o;){const a=i+o>>>1;e<t[a]?o=a:i=a+1}if(s=t[i],r=t[i-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,r,s)}return this.interpolate_(i,r,e,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){const t=this.resultBuffer,i=this.sampleValues,s=this.valueSize,r=e*s;for(let o=0;o!==s;++o)t[o]=i[r+o];return t}interpolate_(){throw new Error("call to abstract method")}intervalChanged_(){}}class mv extends sa{constructor(e,t,i,s){super(e,t,i,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:fd,endingEnd:fd}}intervalChanged_(e,t,i){const s=this.parameterPositions;let r=e-2,o=e+1,a=s[r],l=s[o];if(a===void 0)switch(this.getSettings_().endingStart){case pd:r=e,a=2*t-i;break;case Ad:r=s.length-2,a=t+s[r]-s[r+1];break;default:r=e,a=i}if(l===void 0)switch(this.getSettings_().endingEnd){case pd:o=e,l=2*i-t;break;case Ad:o=1,l=i+s[1]-s[0];break;default:o=e-1,l=t}const c=(i-t)*.5,u=this.valueSize;this._weightPrev=c/(t-a),this._weightNext=c/(l-i),this._offsetPrev=r*u,this._offsetNext=o*u}interpolate_(e,t,i,s){const r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,u=this._offsetPrev,h=this._offsetNext,d=this._weightPrev,f=this._weightNext,A=(i-t)/(s-t),g=A*A,m=g*A,p=-d*m+2*d*g-d*A,E=(1+d)*m+(-1.5-2*d)*g+(-.5+d)*A+1,v=(-1-f)*m+(1.5+f)*g+.5*A,_=f*m-f*g;for(let x=0;x!==a;++x)r[x]=p*o[u+x]+E*o[c+x]+v*o[l+x]+_*o[h+x];return r}}class gv extends sa{constructor(e,t,i,s){super(e,t,i,s)}interpolate_(e,t,i,s){const r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,u=(i-t)/(s-t),h=1-u;for(let d=0;d!==a;++d)r[d]=o[c+d]*h+o[l+d]*u;return r}}class _v extends sa{constructor(e,t,i,s){super(e,t,i,s)}interpolate_(e){return this.copySampleValue_(e-1)}}class qn{constructor(e,t,i,s){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=Ha(t,this.TimeBufferType),this.values=Ha(i,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(e){const t=e.constructor;let i;if(t.toJSON!==this.toJSON)i=t.toJSON(e);else{i={name:e.name,times:Ha(e.times,Array),values:Ha(e.values,Array)};const s=e.getInterpolation();s!==e.DefaultInterpolation&&(i.interpolation=s)}return i.type=e.ValueTypeName,i}InterpolantFactoryMethodDiscrete(e){return new _v(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new gv(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new mv(this.times,this.values,this.getValueSize(),e)}setInterpolation(e){let t;switch(e){case Wo:t=this.InterpolantFactoryMethodDiscrete;break;case qo:t=this.InterpolantFactoryMethodLinear;break;case nc:t=this.InterpolantFactoryMethodSmooth;break}if(t===void 0){const i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return console.warn("THREE.KeyframeTrack:",i),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Wo;case this.InterpolantFactoryMethodLinear:return qo;case this.InterpolantFactoryMethodSmooth:return nc}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){const t=this.times;for(let i=0,s=t.length;i!==s;++i)t[i]+=e}return this}scale(e){if(e!==1){const t=this.times;for(let i=0,s=t.length;i!==s;++i)t[i]*=e}return this}trim(e,t){const i=this.times,s=i.length;let r=0,o=s-1;for(;r!==s&&i[r]<e;)++r;for(;o!==-1&&i[o]>t;)--o;if(++o,r!==0||o!==s){r>=o&&(o=Math.max(o,1),r=o-1);const a=this.getValueSize();this.times=i.slice(r,o),this.values=this.values.slice(r*a,o*a)}return this}validate(){let e=!0;const t=this.getValueSize();t-Math.floor(t)!==0&&(console.error("THREE.KeyframeTrack: Invalid value size in track.",this),e=!1);const i=this.times,s=this.values,r=i.length;r===0&&(console.error("THREE.KeyframeTrack: Track is empty.",this),e=!1);let o=null;for(let a=0;a!==r;a++){const l=i[a];if(typeof l=="number"&&isNaN(l)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,a,l),e=!1;break}if(o!==null&&o>l){console.error("THREE.KeyframeTrack: Out of order keys.",this,a,l,o),e=!1;break}o=l}if(s!==void 0&&pv(s))for(let a=0,l=s.length;a!==l;++a){const c=s[a];if(isNaN(c)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,a,c),e=!1;break}}return e}optimize(){const e=this.times.slice(),t=this.values.slice(),i=this.getValueSize(),s=this.getInterpolation()===nc,r=e.length-1;let o=1;for(let a=1;a<r;++a){let l=!1;const c=e[a],u=e[a+1];if(c!==u&&(a!==1||c!==e[0]))if(s)l=!0;else{const h=a*i,d=h-i,f=h+i;for(let A=0;A!==i;++A){const g=t[h+A];if(g!==t[d+A]||g!==t[f+A]){l=!0;break}}}if(l){if(a!==o){e[o]=e[a];const h=a*i,d=o*i;for(let f=0;f!==i;++f)t[d+f]=t[h+f]}++o}}if(r>0){e[o]=e[r];for(let a=r*i,l=o*i,c=0;c!==i;++c)t[l+c]=t[a+c];++o}return o!==e.length?(this.times=e.slice(0,o),this.values=t.slice(0,o*i)):(this.times=e,this.values=t),this}clone(){const e=this.times.slice(),t=this.values.slice(),i=this.constructor,s=new i(this.name,e,t);return s.createInterpolant=this.createInterpolant,s}}qn.prototype.ValueTypeName="";qn.prototype.TimeBufferType=Float32Array;qn.prototype.ValueBufferType=Float32Array;qn.prototype.DefaultInterpolation=qo;class zr extends qn{constructor(e,t,i){super(e,t,i)}}zr.prototype.ValueTypeName="bool";zr.prototype.ValueBufferType=Array;zr.prototype.DefaultInterpolation=Wo;zr.prototype.InterpolantFactoryMethodLinear=void 0;zr.prototype.InterpolantFactoryMethodSmooth=void 0;class JA extends qn{constructor(e,t,i,s){super(e,t,i,s)}}JA.prototype.ValueTypeName="color";class Pr extends qn{constructor(e,t,i,s){super(e,t,i,s)}}Pr.prototype.ValueTypeName="number";class vv extends sa{constructor(e,t,i,s){super(e,t,i,s)}interpolate_(e,t,i,s){const r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(i-t)/(s-t);let c=e*a;for(let u=c+a;c!==u;c+=4)je.slerpFlat(r,0,o,c-a,o,c,l);return r}}class Ur extends qn{constructor(e,t,i,s){super(e,t,i,s)}InterpolantFactoryMethodLinear(e){return new vv(this.times,this.values,this.getValueSize(),e)}}Ur.prototype.ValueTypeName="quaternion";Ur.prototype.InterpolantFactoryMethodSmooth=void 0;class Vr extends qn{constructor(e,t,i){super(e,t,i)}}Vr.prototype.ValueTypeName="string";Vr.prototype.ValueBufferType=Array;Vr.prototype.DefaultInterpolation=Wo;Vr.prototype.InterpolantFactoryMethodLinear=void 0;Vr.prototype.InterpolantFactoryMethodSmooth=void 0;class Fr extends qn{constructor(e,t,i,s){super(e,t,i,s)}}Fr.prototype.ValueTypeName="vector";class xv{constructor(e="",t=-1,i=[],s=w0){this.name=e,this.tracks=i,this.duration=t,this.blendMode=s,this.uuid=Fn(),this.userData={},this.duration<0&&this.resetDuration()}static parse(e){const t=[],i=e.tracks,s=1/(e.fps||1);for(let o=0,a=i.length;o!==a;++o)t.push(bv(i[o]).scale(s));const r=new this(e.name,e.duration,t,e.blendMode);return r.uuid=e.uuid,r.userData=JSON.parse(e.userData||"{}"),r}static toJSON(e){const t=[],i=e.tracks,s={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode,userData:JSON.stringify(e.userData)};for(let r=0,o=i.length;r!==o;++r)t.push(qn.toJSON(i[r]));return s}static CreateFromMorphTargetSequence(e,t,i,s){const r=t.length,o=[];for(let a=0;a<r;a++){let l=[],c=[];l.push((a+r-1)%r,a,(a+1)%r),c.push(0,1,0);const u=Av(l);l=sf(l,1,u),c=sf(c,1,u),!s&&l[0]===0&&(l.push(r),c.push(c[0])),o.push(new Pr(".morphTargetInfluences["+t[a].name+"]",l,c).scale(1/i))}return new this(e,-1,o)}static findByName(e,t){let i=e;if(!Array.isArray(e)){const s=e;i=s.geometry&&s.geometry.animations||s.animations}for(let s=0;s<i.length;s++)if(i[s].name===t)return i[s];return null}static CreateClipsFromMorphTargetSequences(e,t,i){const s={},r=/^([\w-]*?)([\d]+)$/;for(let a=0,l=e.length;a<l;a++){const c=e[a],u=c.name.match(r);if(u&&u.length>1){const h=u[1];let d=s[h];d||(s[h]=d=[]),d.push(c)}}const o=[];for(const a in s)o.push(this.CreateFromMorphTargetSequence(a,s[a],t,i));return o}static parseAnimation(e,t){if(console.warn("THREE.AnimationClip: parseAnimation() is deprecated and will be removed with r185"),!e)return console.error("THREE.AnimationClip: No animation in JSONLoader data."),null;const i=function(h,d,f,A,g){if(f.length!==0){const m=[],p=[];jA(f,m,p,A),m.length!==0&&g.push(new h(d,m,p))}},s=[],r=e.name||"default",o=e.fps||30,a=e.blendMode;let l=e.length||-1;const c=e.hierarchy||[];for(let h=0;h<c.length;h++){const d=c[h].keys;if(!(!d||d.length===0))if(d[0].morphTargets){const f={};let A;for(A=0;A<d.length;A++)if(d[A].morphTargets)for(let g=0;g<d[A].morphTargets.length;g++)f[d[A].morphTargets[g]]=-1;for(const g in f){const m=[],p=[];for(let E=0;E!==d[A].morphTargets.length;++E){const v=d[A];m.push(v.time),p.push(v.morphTarget===g?1:0)}s.push(new Pr(".morphTargetInfluence["+g+"]",m,p))}l=f.length*o}else{const f=".bones["+t[h].name+"]";i(Fr,f+".position",d,"pos",s),i(Ur,f+".quaternion",d,"rot",s),i(Fr,f+".scale",d,"scl",s)}}return s.length===0?null:new this(r,l,s,a)}resetDuration(){const e=this.tracks;let t=0;for(let i=0,s=e.length;i!==s;++i){const r=this.tracks[i];t=Math.max(t,r.times[r.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){const e=[];for(let i=0;i<this.tracks.length;i++)e.push(this.tracks[i].clone());const t=new this.constructor(this.name,this.duration,e,this.blendMode);return t.userData=JSON.parse(JSON.stringify(this.userData)),t}toJSON(){return this.constructor.toJSON(this)}}function Ev(n){switch(n.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return Pr;case"vector":case"vector2":case"vector3":case"vector4":return Fr;case"color":return JA;case"quaternion":return Ur;case"bool":case"boolean":return zr;case"string":return Vr}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+n)}function bv(n){if(n.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");const e=Ev(n.type);if(n.times===void 0){const t=[],i=[];jA(n.keys,t,i,"value"),n.times=t,n.values=i}return e.parse!==void 0?e.parse(n):new e(n.name,n.times,n.values,n.interpolation)}const yi={enabled:!1,files:{},add:function(n,e){this.enabled!==!1&&(this.files[n]=e)},get:function(n){if(this.enabled!==!1)return this.files[n]},remove:function(n){delete this.files[n]},clear:function(){this.files={}}};class KA{constructor(e,t,i){const s=this;let r=!1,o=0,a=0,l;const c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=i,this.abortController=new AbortController,this.itemStart=function(u){a++,r===!1&&s.onStart!==void 0&&s.onStart(u,o,a),r=!0},this.itemEnd=function(u){o++,s.onProgress!==void 0&&s.onProgress(u,o,a),o===a&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(u){s.onError!==void 0&&s.onError(u)},this.resolveURL=function(u){return l?l(u):u},this.setURLModifier=function(u){return l=u,this},this.addHandler=function(u,h){return c.push(u,h),this},this.removeHandler=function(u){const h=c.indexOf(u);return h!==-1&&c.splice(h,2),this},this.getHandler=function(u){for(let h=0,d=c.length;h<d;h+=2){const f=c[h],A=c[h+1];if(f.global&&(f.lastIndex=0),f.test(u))return A}return null},this.abort=function(){return this.abortController.abort(),this.abortController=new AbortController,this}}}const yv=new KA;class Rs{constructor(e){this.manager=e!==void 0?e:yv,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync(e,t){const i=this;return new Promise(function(s,r){i.load(e,s,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}}Rs.DEFAULT_MATERIAL_NAME="__DEFAULT";const mi={};class Mv extends Error{constructor(e,t){super(e),this.response=t}}class Lo extends Rs{constructor(e){super(e),this.mimeType="",this.responseType="",this._abortController=new AbortController}load(e,t,i,s){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const r=yi.get(`file:${e}`);if(r!==void 0)return this.manager.itemStart(e),setTimeout(()=>{t&&t(r),this.manager.itemEnd(e)},0),r;if(mi[e]!==void 0){mi[e].push({onLoad:t,onProgress:i,onError:s});return}mi[e]=[],mi[e].push({onLoad:t,onProgress:i,onError:s});const o=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin",signal:typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal}),a=this.mimeType,l=this.responseType;fetch(o).then(c=>{if(c.status===200||c.status===0){if(c.status===0&&console.warn("THREE.FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||c.body===void 0||c.body.getReader===void 0)return c;const u=mi[e],h=c.body.getReader(),d=c.headers.get("X-File-Size")||c.headers.get("Content-Length"),f=d?parseInt(d):0,A=f!==0;let g=0;const m=new ReadableStream({start(p){E();function E(){h.read().then(({done:v,value:_})=>{if(v)p.close();else{g+=_.byteLength;const x=new ProgressEvent("progress",{lengthComputable:A,loaded:g,total:f});for(let S=0,I=u.length;S<I;S++){const L=u[S];L.onProgress&&L.onProgress(x)}p.enqueue(_),E()}},v=>{p.error(v)})}}});return new Response(m)}else throw new Mv(`fetch for "${c.url}" responded with ${c.status}: ${c.statusText}`,c)}).then(c=>{switch(l){case"arraybuffer":return c.arrayBuffer();case"blob":return c.blob();case"document":return c.text().then(u=>new DOMParser().parseFromString(u,a));case"json":return c.json();default:if(a==="")return c.text();{const h=/charset="?([^;"\s]*)"?/i.exec(a),d=h&&h[1]?h[1].toLowerCase():void 0,f=new TextDecoder(d);return c.arrayBuffer().then(A=>f.decode(A))}}}).then(c=>{yi.add(`file:${e}`,c);const u=mi[e];delete mi[e];for(let h=0,d=u.length;h<d;h++){const f=u[h];f.onLoad&&f.onLoad(c)}}).catch(c=>{const u=mi[e];if(u===void 0)throw this.manager.itemError(e),c;delete mi[e];for(let h=0,d=u.length;h<d;h++){const f=u[h];f.onError&&f.onError(c)}this.manager.itemError(e)}).finally(()=>{this.manager.itemEnd(e)}),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}}const er=new WeakMap;class ZA extends Rs{constructor(e){super(e)}load(e,t,i,s){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const r=this,o=yi.get(`image:${e}`);if(o!==void 0){if(o.complete===!0)r.manager.itemStart(e),setTimeout(function(){t&&t(o),r.manager.itemEnd(e)},0);else{let h=er.get(o);h===void 0&&(h=[],er.set(o,h)),h.push({onLoad:t,onError:s})}return o}const a=Xo("img");function l(){u(),t&&t(this);const h=er.get(this)||[];for(let d=0;d<h.length;d++){const f=h[d];f.onLoad&&f.onLoad(this)}er.delete(this),r.manager.itemEnd(e)}function c(h){u(),s&&s(h),yi.remove(`image:${e}`);const d=er.get(this)||[];for(let f=0;f<d.length;f++){const A=d[f];A.onError&&A.onError(h)}er.delete(this),r.manager.itemError(e),r.manager.itemEnd(e)}function u(){a.removeEventListener("load",l,!1),a.removeEventListener("error",c,!1)}return a.addEventListener("load",l,!1),a.addEventListener("error",c,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(a.crossOrigin=this.crossOrigin),yi.add(`image:${e}`,a),r.manager.itemStart(e),a.src=e,a}}class Sv extends Rs{constructor(e){super(e)}load(e,t,i,s){const r=new Qt,o=new ZA(this.manager);return o.setCrossOrigin(this.crossOrigin),o.setPath(this.path),o.load(e,function(a){r.image=a,r.needsUpdate=!0,t!==void 0&&t(r)},i,s),r}}class Xl extends vt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new ye(e),this.intensity=t}dispose(){}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,this.groundColor!==void 0&&(t.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(t.object.distance=this.distance),this.angle!==void 0&&(t.object.angle=this.angle),this.decay!==void 0&&(t.object.decay=this.decay),this.penumbra!==void 0&&(t.object.penumbra=this.penumbra),this.shadow!==void 0&&(t.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(t.object.target=this.target.uuid),t}}class wv extends Xl{constructor(e,t,i){super(e,i),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(vt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new ye(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}}const Lc=new Qe,rf=new w,of=new w;class kh{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new ce(512,512),this.mapType=tt,this.map=null,this.mapPass=null,this.matrix=new Qe,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Rh,this._frameExtents=new ce(1,1),this._viewportCount=1,this._viewports=[new ft(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,i=this.matrix;rf.setFromMatrixPosition(e.matrixWorld),t.position.copy(rf),of.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(of),t.updateMatrixWorld(),Lc.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Lc,t.coordinateSystem,t.reversedDepth),t.reversedDepth?i.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):i.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),i.multiply(Lc)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}class Cv extends kh{constructor(){super(new hn(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1,this.aspect=1}updateMatrices(e){const t=this.camera,i=Br*2*e.angle*this.focus,s=this.mapSize.width/this.mapSize.height*this.aspect,r=e.distance||t.far;(i!==t.fov||s!==t.aspect||r!==t.far)&&(t.fov=i,t.aspect=s,t.far=r,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this}}class Iv extends Xl{constructor(e,t,i=0,s=Math.PI/3,r=0,o=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(vt.DEFAULT_UP),this.updateMatrix(),this.target=new vt,this.distance=i,this.angle=s,this.penumbra=r,this.decay=o,this.map=null,this.shadow=new Cv}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}const af=new Qe,ao=new w,Dc=new w;class Tv extends kh{constructor(){super(new hn(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new ce(4,2),this._viewportCount=6,this._viewports=[new ft(2,1,1,1),new ft(0,1,1,1),new ft(3,1,1,1),new ft(1,1,1,1),new ft(3,0,1,1),new ft(1,0,1,1)],this._cubeDirections=[new w(1,0,0),new w(-1,0,0),new w(0,0,1),new w(0,0,-1),new w(0,1,0),new w(0,-1,0)],this._cubeUps=[new w(0,1,0),new w(0,1,0),new w(0,1,0),new w(0,1,0),new w(0,0,1),new w(0,0,-1)]}updateMatrices(e,t=0){const i=this.camera,s=this.matrix,r=e.distance||i.far;r!==i.far&&(i.far=r,i.updateProjectionMatrix()),ao.setFromMatrixPosition(e.matrixWorld),i.position.copy(ao),Dc.copy(i.position),Dc.add(this._cubeDirections[t]),i.up.copy(this._cubeUps[t]),i.lookAt(Dc),i.updateMatrixWorld(),s.makeTranslation(-ao.x,-ao.y,-ao.z),af.multiplyMatrices(i.projectionMatrix,i.matrixWorldInverse),this._frustum.setFromProjectionMatrix(af,i.coordinateSystem,i.reversedDepth)}}class Rv extends Xl{constructor(e,t,i=0,s=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=i,this.decay=s,this.shadow=new Tv}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}}class Qh extends IA{constructor(e=-1,t=1,i=1,s=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=s,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,i,s,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=i-e,o=i+e,a=s+t,l=s-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,o=r+c*this.view.width,a-=u*this.view.offsetY,l=a-u*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}class Bv extends kh{constructor(){super(new Qh(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class $A extends Xl{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(vt.DEFAULT_UP),this.updateMatrix(),this.target=new vt,this.shadow=new Bv}dispose(){this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}}class Do{static extractUrlBase(e){const t=e.lastIndexOf("/");return t===-1?"./":e.slice(0,t+1)}static resolveURL(e,t){return typeof e!="string"||e===""?"":(/^https?:\/\//i.test(t)&&/^\//.test(e)&&(t=t.replace(/(^https?:\/\/[^\/]+).*/i,"$1")),/^(https?:)?\/\//i.test(e)||/^data:.*,.*$/i.test(e)||/^blob:.*$/i.test(e)?e:t+e)}}const Pc=new WeakMap;class Lv extends Rs{constructor(e){super(e),this.isImageBitmapLoader=!0,typeof createImageBitmap>"u"&&console.warn("THREE.ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch>"u"&&console.warn("THREE.ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"},this._abortController=new AbortController}setOptions(e){return this.options=e,this}load(e,t,i,s){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);const r=this,o=yi.get(`image-bitmap:${e}`);if(o!==void 0){if(r.manager.itemStart(e),o.then){o.then(c=>{if(Pc.has(o)===!0)s&&s(Pc.get(o)),r.manager.itemError(e),r.manager.itemEnd(e);else return t&&t(c),r.manager.itemEnd(e),c});return}return setTimeout(function(){t&&t(o),r.manager.itemEnd(e)},0),o}const a={};a.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",a.headers=this.requestHeader,a.signal=typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal;const l=fetch(e,a).then(function(c){return c.blob()}).then(function(c){return createImageBitmap(c,Object.assign(r.options,{colorSpaceConversion:"none"}))}).then(function(c){return yi.add(`image-bitmap:${e}`,c),t&&t(c),r.manager.itemEnd(e),c}).catch(function(c){s&&s(c),Pc.set(l,c),yi.remove(`image-bitmap:${e}`),r.manager.itemError(e),r.manager.itemEnd(e)});yi.add(`image-bitmap:${e}`,l),r.manager.itemStart(e)}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}}class Dv extends hn{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}class Pv{constructor(e=!0){this.autoStart=e,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1}start(){this.startTime=performance.now(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let e=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){const t=performance.now();e=(t-this.oldTime)/1e3,this.oldTime=t,this.elapsedTime+=e}return e}}const Hh="\\[\\]\\.:\\/",Uv=new RegExp("["+Hh+"]","g"),Gh="[^"+Hh+"]",Fv="[^"+Hh.replace("\\.","")+"]",Nv=/((?:WC+[\/:])*)/.source.replace("WC",Gh),Ov=/(WCOD+)?/.source.replace("WCOD",Fv),kv=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Gh),Qv=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Gh),Hv=new RegExp("^"+Nv+Ov+kv+Qv+"$"),Gv=["material","materials","bones","map"];class zv{constructor(e,t,i){const s=i||_t.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,s)}getValue(e,t){this.bind();const i=this._targetGroup.nCachedObjects_,s=this._bindings[i];s!==void 0&&s.getValue(e,t)}setValue(e,t){const i=this._bindings;for(let s=this._targetGroup.nCachedObjects_,r=i.length;s!==r;++s)i[s].setValue(e,t)}bind(){const e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].bind()}unbind(){const e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].unbind()}}class _t{constructor(e,t,i){this.path=t,this.parsedPath=i||_t.parseTrackName(t),this.node=_t.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,i){return e&&e.isAnimationObjectGroup?new _t.Composite(e,t,i):new _t(e,t,i)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(Uv,"")}static parseTrackName(e){const t=Hv.exec(e);if(t===null)throw new Error("PropertyBinding: Cannot parse trackName: "+e);const i={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},s=i.nodeName&&i.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){const r=i.nodeName.substring(s+1);Gv.indexOf(r)!==-1&&(i.nodeName=i.nodeName.substring(0,s),i.objectName=r)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("PropertyBinding: can not parse propertyName from trackName: "+e);return i}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){const i=e.skeleton.getBoneByName(t);if(i!==void 0)return i}if(e.children){const i=function(r){for(let o=0;o<r.length;o++){const a=r[o];if(a.name===t||a.uuid===t)return a;const l=i(a.children);if(l)return l}return null},s=i(e.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){const i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)e[t++]=i[s]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){const i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)i[s]=e[t++]}_setValue_array_setNeedsUpdate(e,t){const i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)i[s]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){const i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)i[s]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node;const t=this.parsedPath,i=t.objectName,s=t.propertyName;let r=t.propertyIndex;if(e||(e=_t.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let c=t.objectIndex;switch(i){case"materials":if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let u=0;u<e.length;u++)if(e[u].name===c){c=u;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[i]===void 0){console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[i]}if(c!==void 0){if(e[c]===void 0){console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}const o=e[s];if(o===void 0){const c=t.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+c+"."+s+" but it wasn't found.",e);return}let a=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?a=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(s==="morphTargetInfluences"){if(!e.geometry){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[r]!==void 0&&(r=e.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=r}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=s;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}}_t.Composite=zv;_t.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};_t.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};_t.prototype.GetterByBindingType=[_t.prototype._getValue_direct,_t.prototype._getValue_array,_t.prototype._getValue_arrayElement,_t.prototype._getValue_toArray];_t.prototype.SetterByBindingTypeAndVersioning=[[_t.prototype._setValue_direct,_t.prototype._setValue_direct_setNeedsUpdate,_t.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[_t.prototype._setValue_array,_t.prototype._setValue_array_setNeedsUpdate,_t.prototype._setValue_array_setMatrixWorldNeedsUpdate],[_t.prototype._setValue_arrayElement,_t.prototype._setValue_arrayElement_setNeedsUpdate,_t.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[_t.prototype._setValue_fromArray,_t.prototype._setValue_fromArray_setNeedsUpdate,_t.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];class lf{constructor(e,t,i,s,r,o=!1){this.isGLBufferAttribute=!0,this.name="",this.buffer=e,this.type=t,this.itemSize=i,this.elementSize=s,this.count=r,this.normalized=o,this.version=0}set needsUpdate(e){e===!0&&this.version++}setBuffer(e){return this.buffer=e,this}setType(e,t){return this.type=e,this.elementSize=t,this}setItemSize(e){return this.itemSize=e,this}setCount(e){return this.count=e,this}}class Vv extends ia{constructor(e=1){const t=[0,0,0,e,0,0,0,0,0,0,e,0,0,0,0,0,0,e],i=[1,0,0,1,.6,0,0,1,0,.6,1,0,0,0,1,0,.6,1],s=new mt;s.setAttribute("position",new pt(t,3)),s.setAttribute("color",new pt(i,3));const r=new Ts({vertexColors:!0,toneMapped:!1});super(s,r),this.type="AxesHelper"}setColors(e,t,i){const s=new ye,r=this.geometry.attributes.color.array;return s.set(e),s.toArray(r,0),s.toArray(r,3),s.set(t),s.toArray(r,6),s.toArray(r,9),s.set(i),s.toArray(r,12),s.toArray(r,15),this.geometry.attributes.color.needsUpdate=!0,this}dispose(){this.geometry.dispose(),this.material.dispose()}}function cf(n,e,t,i){const s=Wv(i);switch(t){case mA:return n*e;case Oi:return n*e/s.components*s.byteLength;case Mh:return n*e/s.components*s.byteLength;case ds:return n*e*2/s.components*s.byteLength;case Sh:return n*e*2/s.components*s.byteLength;case ko:return n*e*3/s.components*s.byteLength;case Ht:return n*e*4/s.components*s.byteLength;case wh:return n*e*4/s.components*s.byteLength;case vr:case gs:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case xr:case Co:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Uu:case Go:return Math.max(n,16)*Math.max(e,8)/4;case gl:case Tr:return Math.max(n,8)*Math.max(e,8)/2;case _l:case zo:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*8;case Vo:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case _s:return Math.floor((n+3)/4)*Math.floor((e+3)/4)*16;case Fu:return Math.floor((n+4)/5)*Math.floor((e+3)/4)*16;case Nu:return Math.floor((n+4)/5)*Math.floor((e+4)/5)*16;case Ou:return Math.floor((n+5)/6)*Math.floor((e+4)/5)*16;case Er:return Math.floor((n+5)/6)*Math.floor((e+5)/6)*16;case ku:return Math.floor((n+7)/8)*Math.floor((e+4)/5)*16;case Qu:return Math.floor((n+7)/8)*Math.floor((e+5)/6)*16;case Hu:return Math.floor((n+7)/8)*Math.floor((e+7)/8)*16;case Gu:return Math.floor((n+9)/10)*Math.floor((e+4)/5)*16;case zu:return Math.floor((n+9)/10)*Math.floor((e+5)/6)*16;case Vu:return Math.floor((n+9)/10)*Math.floor((e+7)/8)*16;case Wu:return Math.floor((n+9)/10)*Math.floor((e+9)/10)*16;case qu:return Math.floor((n+11)/12)*Math.floor((e+9)/10)*16;case Xu:return Math.floor((n+11)/12)*Math.floor((e+11)/12)*16;case Rr:case Yu:case vl:return Math.ceil(n/4)*Math.ceil(e/4)*16;case xl:case El:return Math.ceil(n/4)*Math.ceil(e/4)*8;case bl:case yl:return Math.ceil(n/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function Wv(n){switch(n){case tt:case pA:return{byteLength:1,components:1};case No:case AA:case Ln:return{byteLength:2,components:1};case bh:case yh:return{byteLength:2,components:4};case bs:case Eh:case sn:return{byteLength:4,components:1};case Ql:case Hl:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${n}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:vs}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=vs);/**
 * @license
 * Copyright 2010-2025 Three.js Authors
 * SPDX-License-Identifier: MIT
 */function em(){let n=null,e=!1,t=null,i=null;function s(r,o){t(r,o),i=n.requestAnimationFrame(s)}return{start:function(){e!==!0&&t!==null&&(i=n.requestAnimationFrame(s),e=!0)},stop:function(){n.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){n=r}}}function qv(n){const e=new WeakMap;function t(a,l){const c=a.array,u=a.usage,h=c.byteLength,d=n.createBuffer();n.bindBuffer(l,d),n.bufferData(l,c,u),a.onUploadCallback();let f;if(c instanceof Float32Array)f=n.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)f=n.HALF_FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?f=n.HALF_FLOAT:f=n.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=n.SHORT;else if(c instanceof Uint32Array)f=n.UNSIGNED_INT;else if(c instanceof Int32Array)f=n.INT;else if(c instanceof Int8Array)f=n.BYTE;else if(c instanceof Uint8Array)f=n.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:h}}function i(a,l,c){const u=l.array,h=l.updateRanges;if(n.bindBuffer(c,a),h.length===0)n.bufferSubData(c,0,u);else{h.sort((f,A)=>f.start-A.start);let d=0;for(let f=1;f<h.length;f++){const A=h[d],g=h[f];g.start<=A.start+A.count+1?A.count=Math.max(A.count,g.start+g.count-A.start):(++d,h[d]=g)}h.length=d+1;for(let f=0,A=h.length;f<A;f++){const g=h[f];n.bufferSubData(c,g.start*u.BYTES_PER_ELEMENT,u,g.start,g.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);const l=e.get(a);l&&(n.deleteBuffer(l.buffer),e.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){const u=e.get(a);(!u||u.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}const c=e.get(a);if(c===void 0)e.set(a,t(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,a,l),c.version=a.version}}return{get:s,remove:r,update:o}}var Xv=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Yv=`#ifdef USE_ALPHAHASH
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
#endif`,jv=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Jv=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Kv=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Zv=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,$v=`#ifdef USE_AOMAP
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
#endif`,ex=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,tx=`#ifdef USE_BATCHING
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
#endif`,nx=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,ix=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,sx=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,rx=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,ox=`#ifdef USE_IRIDESCENCE
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
#endif`,ax=`#ifdef USE_BUMPMAP
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
#endif`,lx=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,cx=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,ux=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,hx=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,dx=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,fx=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,px=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,Ax=`#if defined( USE_COLOR_ALPHA )
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
#endif`,mx=`#define PI 3.141592653589793
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
} // validated`,gx=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,_x=`vec3 transformedNormal = objectNormal;
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
#endif`,vx=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,xx=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Ex=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,bx=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,yx="gl_FragColor = linearToOutputTexel( gl_FragColor );",Mx=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Sx=`#ifdef USE_ENVMAP
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
#endif`,wx=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,Cx=`#ifdef USE_ENVMAP
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
#endif`,Ix=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Tx=`#ifdef USE_ENVMAP
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
#endif`,Rx=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Bx=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Lx=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Dx=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Px=`#ifdef USE_GRADIENTMAP
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
}`,Ux=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Fx=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Nx=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Ox=`uniform bool receiveShadow;
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
#endif`,kx=`#ifdef USE_ENVMAP
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
#endif`,Qx=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Hx=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Gx=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,zx=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Vx=`PhysicalMaterial material;
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
#endif`,Wx=`struct PhysicalMaterial {
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
}`,qx=`
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
#endif`,Xx=`#if defined( RE_IndirectDiffuse )
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
#endif`,Yx=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,jx=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Jx=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Kx=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Zx=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,$x=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,eE=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,tE=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,nE=`#if defined( USE_POINTS_UV )
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
#endif`,iE=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,sE=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,rE=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,oE=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,aE=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,lE=`#ifdef USE_MORPHTARGETS
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
#endif`,cE=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,uE=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,hE=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,dE=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,fE=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,pE=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,AE=`#ifdef USE_NORMALMAP
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
#endif`,mE=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,gE=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,_E=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,vE=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,xE=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,EE=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,bE=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,yE=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,ME=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,SE=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,wE=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,CE=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,IE=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,TE=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,RE=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,BE=`float getShadowMask() {
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
}`,LE=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,DE=`#ifdef USE_SKINNING
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
#endif`,PE=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,UE=`#ifdef USE_SKINNING
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
#endif`,FE=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,NE=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,OE=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,kE=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,QE=`#ifdef USE_TRANSMISSION
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
#endif`,HE=`#ifdef USE_TRANSMISSION
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
#endif`,GE=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,zE=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,VE=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,WE=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const qE=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,XE=`uniform sampler2D t2D;
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
}`,YE=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,jE=`#ifdef ENVMAP_TYPE_CUBE
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
}`,JE=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,KE=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,ZE=`#include <common>
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
}`,$E=`#if DEPTH_PACKING == 3200
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
}`,eb=`#define DISTANCE
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
}`,tb=`#define DISTANCE
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
}`,nb=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,ib=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,sb=`uniform float scale;
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
}`,ob=`#include <common>
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
}`,lb=`#define LAMBERT
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
}`,cb=`#define LAMBERT
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
}`,ub=`#define MATCAP
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
}`,hb=`#define MATCAP
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
}`,db=`#define NORMAL
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
}`,fb=`#define NORMAL
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
}`,pb=`#define PHONG
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
}`,Ab=`#define PHONG
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
}`,mb=`#define STANDARD
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
}`,gb=`#define STANDARD
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
}`,_b=`#define TOON
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
}`,vb=`#define TOON
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
}`,xb=`uniform float size;
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
}`,Eb=`uniform vec3 diffuse;
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
}`,yb=`uniform vec3 color;
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
}`,Mb=`uniform float rotation;
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
}`,Sb=`uniform vec3 diffuse;
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
}`,et={alphahash_fragment:Xv,alphahash_pars_fragment:Yv,alphamap_fragment:jv,alphamap_pars_fragment:Jv,alphatest_fragment:Kv,alphatest_pars_fragment:Zv,aomap_fragment:$v,aomap_pars_fragment:ex,batching_pars_vertex:tx,batching_vertex:nx,begin_vertex:ix,beginnormal_vertex:sx,bsdfs:rx,iridescence_fragment:ox,bumpmap_pars_fragment:ax,clipping_planes_fragment:lx,clipping_planes_pars_fragment:cx,clipping_planes_pars_vertex:ux,clipping_planes_vertex:hx,color_fragment:dx,color_pars_fragment:fx,color_pars_vertex:px,color_vertex:Ax,common:mx,cube_uv_reflection_fragment:gx,defaultnormal_vertex:_x,displacementmap_pars_vertex:vx,displacementmap_vertex:xx,emissivemap_fragment:Ex,emissivemap_pars_fragment:bx,colorspace_fragment:yx,colorspace_pars_fragment:Mx,envmap_fragment:Sx,envmap_common_pars_fragment:wx,envmap_pars_fragment:Cx,envmap_pars_vertex:Ix,envmap_physical_pars_fragment:kx,envmap_vertex:Tx,fog_vertex:Rx,fog_pars_vertex:Bx,fog_fragment:Lx,fog_pars_fragment:Dx,gradientmap_pars_fragment:Px,lightmap_pars_fragment:Ux,lights_lambert_fragment:Fx,lights_lambert_pars_fragment:Nx,lights_pars_begin:Ox,lights_toon_fragment:Qx,lights_toon_pars_fragment:Hx,lights_phong_fragment:Gx,lights_phong_pars_fragment:zx,lights_physical_fragment:Vx,lights_physical_pars_fragment:Wx,lights_fragment_begin:qx,lights_fragment_maps:Xx,lights_fragment_end:Yx,logdepthbuf_fragment:jx,logdepthbuf_pars_fragment:Jx,logdepthbuf_pars_vertex:Kx,logdepthbuf_vertex:Zx,map_fragment:$x,map_pars_fragment:eE,map_particle_fragment:tE,map_particle_pars_fragment:nE,metalnessmap_fragment:iE,metalnessmap_pars_fragment:sE,morphinstance_vertex:rE,morphcolor_vertex:oE,morphnormal_vertex:aE,morphtarget_pars_vertex:lE,morphtarget_vertex:cE,normal_fragment_begin:uE,normal_fragment_maps:hE,normal_pars_fragment:dE,normal_pars_vertex:fE,normal_vertex:pE,normalmap_pars_fragment:AE,clearcoat_normal_fragment_begin:mE,clearcoat_normal_fragment_maps:gE,clearcoat_pars_fragment:_E,iridescence_pars_fragment:vE,opaque_fragment:xE,packing:EE,premultiplied_alpha_fragment:bE,project_vertex:yE,dithering_fragment:ME,dithering_pars_fragment:SE,roughnessmap_fragment:wE,roughnessmap_pars_fragment:CE,shadowmap_pars_fragment:IE,shadowmap_pars_vertex:TE,shadowmap_vertex:RE,shadowmask_pars_fragment:BE,skinbase_vertex:LE,skinning_pars_vertex:DE,skinning_vertex:PE,skinnormal_vertex:UE,specularmap_fragment:FE,specularmap_pars_fragment:NE,tonemapping_fragment:OE,tonemapping_pars_fragment:kE,transmission_fragment:QE,transmission_pars_fragment:HE,uv_pars_fragment:GE,uv_pars_vertex:zE,uv_vertex:VE,worldpos_vertex:WE,background_vert:qE,background_frag:XE,backgroundCube_vert:YE,backgroundCube_frag:jE,cube_vert:JE,cube_frag:KE,depth_vert:ZE,depth_frag:$E,distanceRGBA_vert:eb,distanceRGBA_frag:tb,equirect_vert:nb,equirect_frag:ib,linedashed_vert:sb,linedashed_frag:rb,meshbasic_vert:ob,meshbasic_frag:ab,meshlambert_vert:lb,meshlambert_frag:cb,meshmatcap_vert:ub,meshmatcap_frag:hb,meshnormal_vert:db,meshnormal_frag:fb,meshphong_vert:pb,meshphong_frag:Ab,meshphysical_vert:mb,meshphysical_frag:gb,meshtoon_vert:_b,meshtoon_frag:vb,points_vert:xb,points_frag:Eb,shadow_vert:bb,shadow_frag:yb,sprite_vert:Mb,sprite_frag:Sb},ge={common:{diffuse:{value:new ye(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new ze},alphaMap:{value:null},alphaMapTransform:{value:new ze},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new ze}},envmap:{envMap:{value:null},envMapRotation:{value:new ze},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new ze}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new ze}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new ze},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new ze},normalScale:{value:new ce(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new ze},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new ze}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new ze}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new ze}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new ye(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new ye(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new ze},alphaTest:{value:0},uvTransform:{value:new ze}},sprite:{diffuse:{value:new ye(16777215)},opacity:{value:1},center:{value:new ce(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new ze},alphaMap:{value:null},alphaMapTransform:{value:new ze},alphaTest:{value:0}}},ei={basic:{uniforms:cn([ge.common,ge.specularmap,ge.envmap,ge.aomap,ge.lightmap,ge.fog]),vertexShader:et.meshbasic_vert,fragmentShader:et.meshbasic_frag},lambert:{uniforms:cn([ge.common,ge.specularmap,ge.envmap,ge.aomap,ge.lightmap,ge.emissivemap,ge.bumpmap,ge.normalmap,ge.displacementmap,ge.fog,ge.lights,{emissive:{value:new ye(0)}}]),vertexShader:et.meshlambert_vert,fragmentShader:et.meshlambert_frag},phong:{uniforms:cn([ge.common,ge.specularmap,ge.envmap,ge.aomap,ge.lightmap,ge.emissivemap,ge.bumpmap,ge.normalmap,ge.displacementmap,ge.fog,ge.lights,{emissive:{value:new ye(0)},specular:{value:new ye(1118481)},shininess:{value:30}}]),vertexShader:et.meshphong_vert,fragmentShader:et.meshphong_frag},standard:{uniforms:cn([ge.common,ge.envmap,ge.aomap,ge.lightmap,ge.emissivemap,ge.bumpmap,ge.normalmap,ge.displacementmap,ge.roughnessmap,ge.metalnessmap,ge.fog,ge.lights,{emissive:{value:new ye(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:et.meshphysical_vert,fragmentShader:et.meshphysical_frag},toon:{uniforms:cn([ge.common,ge.aomap,ge.lightmap,ge.emissivemap,ge.bumpmap,ge.normalmap,ge.displacementmap,ge.gradientmap,ge.fog,ge.lights,{emissive:{value:new ye(0)}}]),vertexShader:et.meshtoon_vert,fragmentShader:et.meshtoon_frag},matcap:{uniforms:cn([ge.common,ge.bumpmap,ge.normalmap,ge.displacementmap,ge.fog,{matcap:{value:null}}]),vertexShader:et.meshmatcap_vert,fragmentShader:et.meshmatcap_frag},points:{uniforms:cn([ge.points,ge.fog]),vertexShader:et.points_vert,fragmentShader:et.points_frag},dashed:{uniforms:cn([ge.common,ge.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:et.linedashed_vert,fragmentShader:et.linedashed_frag},depth:{uniforms:cn([ge.common,ge.displacementmap]),vertexShader:et.depth_vert,fragmentShader:et.depth_frag},normal:{uniforms:cn([ge.common,ge.bumpmap,ge.normalmap,ge.displacementmap,{opacity:{value:1}}]),vertexShader:et.meshnormal_vert,fragmentShader:et.meshnormal_frag},sprite:{uniforms:cn([ge.sprite,ge.fog]),vertexShader:et.sprite_vert,fragmentShader:et.sprite_frag},background:{uniforms:{uvTransform:{value:new ze},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:et.background_vert,fragmentShader:et.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new ze}},vertexShader:et.backgroundCube_vert,fragmentShader:et.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:et.cube_vert,fragmentShader:et.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:et.equirect_vert,fragmentShader:et.equirect_frag},distanceRGBA:{uniforms:cn([ge.common,ge.displacementmap,{referencePosition:{value:new w},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:et.distanceRGBA_vert,fragmentShader:et.distanceRGBA_frag},shadow:{uniforms:cn([ge.lights,ge.fog,{color:{value:new ye(0)},opacity:{value:1}}]),vertexShader:et.shadow_vert,fragmentShader:et.shadow_frag}};ei.physical={uniforms:cn([ei.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new ze},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new ze},clearcoatNormalScale:{value:new ce(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new ze},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new ze},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new ze},sheen:{value:0},sheenColor:{value:new ye(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new ze},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new ze},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new ze},transmissionSamplerSize:{value:new ce},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new ze},attenuationDistance:{value:0},attenuationColor:{value:new ye(0)},specularColor:{value:new ye(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new ze},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new ze},anisotropyVector:{value:new ce},anisotropyMap:{value:null},anisotropyMapTransform:{value:new ze}}]),vertexShader:et.meshphysical_vert,fragmentShader:et.meshphysical_frag};const Ga={r:0,b:0,g:0},ji=new fn,wb=new Qe;function Cb(n,e,t,i,s,r,o){const a=new ye(0);let l=r===!0?0:1,c,u,h=null,d=0,f=null;function A(v){let _=v.isScene===!0?v.background:null;return _&&_.isTexture&&(_=(v.backgroundBlurriness>0?t:e).get(_)),_}function g(v){let _=!1;const x=A(v);x===null?p(a,l):x&&x.isColor&&(p(x,1),_=!0);const S=n.xr.getEnvironmentBlendMode();S==="additive"?i.buffers.color.setClear(0,0,0,1,o):S==="alpha-blend"&&i.buffers.color.setClear(0,0,0,0,o),(n.autoClear||_)&&(i.buffers.depth.setTest(!0),i.buffers.depth.setMask(!0),i.buffers.color.setMask(!0),n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil))}function m(v,_){const x=A(_);x&&(x.isCubeTexture||x.mapping===kl)?(u===void 0&&(u=new Me(new xn(1,1,1),new Mn({name:"BackgroundCubeMaterial",uniforms:Lr(ei.backgroundCube.uniforms),vertexShader:ei.backgroundCube.vertexShader,fragmentShader:ei.backgroundCube.fragmentShader,side:Yt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),u.geometry.deleteAttribute("normal"),u.geometry.deleteAttribute("uv"),u.onBeforeRender=function(S,I,L){this.matrixWorld.copyPosition(L.matrixWorld)},Object.defineProperty(u.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),s.update(u)),ji.copy(_.backgroundRotation),ji.x*=-1,ji.y*=-1,ji.z*=-1,x.isCubeTexture&&x.isRenderTargetTexture===!1&&(ji.y*=-1,ji.z*=-1),u.material.uniforms.envMap.value=x,u.material.uniforms.flipEnvMap.value=x.isCubeTexture&&x.isRenderTargetTexture===!1?-1:1,u.material.uniforms.backgroundBlurriness.value=_.backgroundBlurriness,u.material.uniforms.backgroundIntensity.value=_.backgroundIntensity,u.material.uniforms.backgroundRotation.value.setFromMatrix4(wb.makeRotationFromEuler(ji)),u.material.toneMapped=lt.getTransfer(x.colorSpace)!==Et,(h!==x||d!==x.version||f!==n.toneMapping)&&(u.material.needsUpdate=!0,h=x,d=x.version,f=n.toneMapping),u.layers.enableAll(),v.unshift(u,u.geometry,u.material,0,0,null)):x&&x.isTexture&&(c===void 0&&(c=new Me(new En(2,2),new Mn({name:"BackgroundMaterial",uniforms:Lr(ei.background.uniforms),vertexShader:ei.background.vertexShader,fragmentShader:ei.background.fragmentShader,side:Ci,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),s.update(c)),c.material.uniforms.t2D.value=x,c.material.uniforms.backgroundIntensity.value=_.backgroundIntensity,c.material.toneMapped=lt.getTransfer(x.colorSpace)!==Et,x.matrixAutoUpdate===!0&&x.updateMatrix(),c.material.uniforms.uvTransform.value.copy(x.matrix),(h!==x||d!==x.version||f!==n.toneMapping)&&(c.material.needsUpdate=!0,h=x,d=x.version,f=n.toneMapping),c.layers.enableAll(),v.unshift(c,c.geometry,c.material,0,0,null))}function p(v,_){v.getRGB(Ga,wA(n)),i.buffers.color.setClear(Ga.r,Ga.g,Ga.b,_,o)}function E(){u!==void 0&&(u.geometry.dispose(),u.material.dispose(),u=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return a},setClearColor:function(v,_=1){a.set(v),l=_,p(a,l)},getClearAlpha:function(){return l},setClearAlpha:function(v){l=v,p(a,l)},render:g,addToRenderList:m,dispose:E}}function Ib(n,e){const t=n.getParameter(n.MAX_VERTEX_ATTRIBS),i={},s=d(null);let r=s,o=!1;function a(b,R,U,N,G){let V=!1;const P=h(N,U,R);r!==P&&(r=P,c(r.object)),V=f(b,N,U,G),V&&A(b,N,U,G),G!==null&&e.update(G,n.ELEMENT_ARRAY_BUFFER),(V||o)&&(o=!1,_(b,R,U,N),G!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,e.get(G).buffer))}function l(){return n.createVertexArray()}function c(b){return n.bindVertexArray(b)}function u(b){return n.deleteVertexArray(b)}function h(b,R,U){const N=U.wireframe===!0;let G=i[b.id];G===void 0&&(G={},i[b.id]=G);let V=G[R.id];V===void 0&&(V={},G[R.id]=V);let P=V[N];return P===void 0&&(P=d(l()),V[N]=P),P}function d(b){const R=[],U=[],N=[];for(let G=0;G<t;G++)R[G]=0,U[G]=0,N[G]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:R,enabledAttributes:U,attributeDivisors:N,object:b,attributes:{},index:null}}function f(b,R,U,N){const G=r.attributes,V=R.attributes;let P=0;const Y=U.getAttributes();for(const H in Y)if(Y[H].location>=0){const se=G[H];let ae=V[H];if(ae===void 0&&(H==="instanceMatrix"&&b.instanceMatrix&&(ae=b.instanceMatrix),H==="instanceColor"&&b.instanceColor&&(ae=b.instanceColor)),se===void 0||se.attribute!==ae||ae&&se.data!==ae.data)return!0;P++}return r.attributesNum!==P||r.index!==N}function A(b,R,U,N){const G={},V=R.attributes;let P=0;const Y=U.getAttributes();for(const H in Y)if(Y[H].location>=0){let se=V[H];se===void 0&&(H==="instanceMatrix"&&b.instanceMatrix&&(se=b.instanceMatrix),H==="instanceColor"&&b.instanceColor&&(se=b.instanceColor));const ae={};ae.attribute=se,se&&se.data&&(ae.data=se.data),G[H]=ae,P++}r.attributes=G,r.attributesNum=P,r.index=N}function g(){const b=r.newAttributes;for(let R=0,U=b.length;R<U;R++)b[R]=0}function m(b){p(b,0)}function p(b,R){const U=r.newAttributes,N=r.enabledAttributes,G=r.attributeDivisors;U[b]=1,N[b]===0&&(n.enableVertexAttribArray(b),N[b]=1),G[b]!==R&&(n.vertexAttribDivisor(b,R),G[b]=R)}function E(){const b=r.newAttributes,R=r.enabledAttributes;for(let U=0,N=R.length;U<N;U++)R[U]!==b[U]&&(n.disableVertexAttribArray(U),R[U]=0)}function v(b,R,U,N,G,V,P){P===!0?n.vertexAttribIPointer(b,R,U,G,V):n.vertexAttribPointer(b,R,U,N,G,V)}function _(b,R,U,N){g();const G=N.attributes,V=U.getAttributes(),P=R.defaultAttributeValues;for(const Y in V){const H=V[Y];if(H.location>=0){let te=G[Y];if(te===void 0&&(Y==="instanceMatrix"&&b.instanceMatrix&&(te=b.instanceMatrix),Y==="instanceColor"&&b.instanceColor&&(te=b.instanceColor)),te!==void 0){const se=te.normalized,ae=te.itemSize,ve=e.get(te);if(ve===void 0)continue;const Oe=ve.buffer,Ke=ve.type,$e=ve.bytesPerElement,K=Ke===n.INT||Ke===n.UNSIGNED_INT||te.gpuType===Eh;if(te.isInterleavedBufferAttribute){const ne=te.data,be=ne.stride,Le=te.offset;if(ne.isInstancedInterleavedBuffer){for(let Se=0;Se<H.locationSize;Se++)p(H.location+Se,ne.meshPerAttribute);b.isInstancedMesh!==!0&&N._maxInstanceCount===void 0&&(N._maxInstanceCount=ne.meshPerAttribute*ne.count)}else for(let Se=0;Se<H.locationSize;Se++)m(H.location+Se);n.bindBuffer(n.ARRAY_BUFFER,Oe);for(let Se=0;Se<H.locationSize;Se++)v(H.location+Se,ae/H.locationSize,Ke,se,be*$e,(Le+ae/H.locationSize*Se)*$e,K)}else{if(te.isInstancedBufferAttribute){for(let ne=0;ne<H.locationSize;ne++)p(H.location+ne,te.meshPerAttribute);b.isInstancedMesh!==!0&&N._maxInstanceCount===void 0&&(N._maxInstanceCount=te.meshPerAttribute*te.count)}else for(let ne=0;ne<H.locationSize;ne++)m(H.location+ne);n.bindBuffer(n.ARRAY_BUFFER,Oe);for(let ne=0;ne<H.locationSize;ne++)v(H.location+ne,ae/H.locationSize,Ke,se,ae*$e,ae/H.locationSize*ne*$e,K)}}else if(P!==void 0){const se=P[Y];if(se!==void 0)switch(se.length){case 2:n.vertexAttrib2fv(H.location,se);break;case 3:n.vertexAttrib3fv(H.location,se);break;case 4:n.vertexAttrib4fv(H.location,se);break;default:n.vertexAttrib1fv(H.location,se)}}}}E()}function x(){L();for(const b in i){const R=i[b];for(const U in R){const N=R[U];for(const G in N)u(N[G].object),delete N[G];delete R[U]}delete i[b]}}function S(b){if(i[b.id]===void 0)return;const R=i[b.id];for(const U in R){const N=R[U];for(const G in N)u(N[G].object),delete N[G];delete R[U]}delete i[b.id]}function I(b){for(const R in i){const U=i[R];if(U[b.id]===void 0)continue;const N=U[b.id];for(const G in N)u(N[G].object),delete N[G];delete U[b.id]}}function L(){y(),o=!0,r!==s&&(r=s,c(r.object))}function y(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:a,reset:L,resetDefaultState:y,dispose:x,releaseStatesOfGeometry:S,releaseStatesOfProgram:I,initAttributes:g,enableAttribute:m,disableUnusedAttributes:E}}function Tb(n,e,t){let i;function s(c){i=c}function r(c,u){n.drawArrays(i,c,u),t.update(u,i,1)}function o(c,u,h){h!==0&&(n.drawArraysInstanced(i,c,u,h),t.update(u,i,h))}function a(c,u,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,c,0,u,0,h);let f=0;for(let A=0;A<h;A++)f+=u[A];t.update(f,i,1)}function l(c,u,h,d){if(h===0)return;const f=e.get("WEBGL_multi_draw");if(f===null)for(let A=0;A<c.length;A++)o(c[A],u[A],d[A]);else{f.multiDrawArraysInstancedWEBGL(i,c,0,u,0,d,0,h);let A=0;for(let g=0;g<h;g++)A+=u[g]*d[g];t.update(A,i,1)}}this.setMode=s,this.render=r,this.renderInstances=o,this.renderMultiDraw=a,this.renderMultiDrawInstances=l}function Rb(n,e,t,i){let s;function r(){if(s!==void 0)return s;if(e.has("EXT_texture_filter_anisotropic")===!0){const I=e.get("EXT_texture_filter_anisotropic");s=n.getParameter(I.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function o(I){return!(I!==Ht&&i.convert(I)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(I){const L=I===Ln&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(I!==tt&&i.convert(I)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE)&&I!==sn&&!L)}function l(I){if(I==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";I="mediump"}return I==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp";const u=l(c);u!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",u,"instead."),c=u);const h=t.logarithmicDepthBuffer===!0,d=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control"),f=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),A=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),g=n.getParameter(n.MAX_TEXTURE_SIZE),m=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),p=n.getParameter(n.MAX_VERTEX_ATTRIBS),E=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),v=n.getParameter(n.MAX_VARYING_VECTORS),_=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),x=A>0,S=n.getParameter(n.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:h,reversedDepthBuffer:d,maxTextures:f,maxVertexTextures:A,maxTextureSize:g,maxCubemapSize:m,maxAttributes:p,maxVertexUniforms:E,maxVaryings:v,maxFragmentUniforms:_,vertexTextures:x,maxSamples:S}}function Bb(n){const e=this;let t=null,i=0,s=!1,r=!1;const o=new rs,a=new ze,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(h,d){const f=h.length!==0||d||i!==0||s;return s=d,i=h.length,f},this.beginShadows=function(){r=!0,u(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(h,d){t=u(h,d,0)},this.setState=function(h,d,f){const A=h.clippingPlanes,g=h.clipIntersection,m=h.clipShadows,p=n.get(h);if(!s||A===null||A.length===0||r&&!m)r?u(null):c();else{const E=r?0:i,v=E*4;let _=p.clippingState||null;l.value=_,_=u(A,d,v,f);for(let x=0;x!==v;++x)_[x]=t[x];p.clippingState=_,this.numIntersection=g?this.numPlanes:0,this.numPlanes+=E}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function u(h,d,f,A){const g=h!==null?h.length:0;let m=null;if(g!==0){if(m=l.value,A!==!0||m===null){const p=f+g*4,E=d.matrixWorldInverse;a.getNormalMatrix(E),(m===null||m.length<p)&&(m=new Float32Array(p));for(let v=0,_=f;v!==g;++v,_+=4)o.copy(h[v]).applyMatrix4(E,a),o.normal.toArray(m,_),m[_+3]=o.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=g,e.numIntersection=0,m}}function Lb(n){let e=new WeakMap;function t(o,a){return a===Du?o.mapping=xs:a===Pu&&(o.mapping=Ir),o}function i(o){if(o&&o.isTexture){const a=o.mapping;if(a===Du||a===Pu)if(e.has(o)){const l=e.get(o).texture;return t(l,o.mapping)}else{const l=o.image;if(l&&l.height>0){const c=new b_(l.height);return c.fromEquirectangularTexture(n,o),e.set(o,c),o.addEventListener("dispose",s),t(c.texture,o.mapping)}else return null}}return o}function s(o){const a=o.target;a.removeEventListener("dispose",s);const l=e.get(a);l!==void 0&&(e.delete(a),l.dispose())}function r(){e=new WeakMap}return{get:i,dispose:r}}const pr=4,uf=[.125,.215,.35,.446,.526,.582],ls=20,Uc=new Qh,hf=new ye;let Fc=null,Nc=0,Oc=0,kc=!1;const os=(1+Math.sqrt(5))/2,tr=1/os,df=[new w(-os,tr,0),new w(os,tr,0),new w(-tr,0,os),new w(tr,0,os),new w(0,os,-tr),new w(0,os,tr),new w(-1,1,-1),new w(1,1,-1),new w(-1,1,1),new w(1,1,1)],Db=new w;class ff{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(e,t=0,i=.1,s=100,r={}){const{size:o=256,position:a=Db}=r;Fc=this._renderer.getRenderTarget(),Nc=this._renderer.getActiveCubeFace(),Oc=this._renderer.getActiveMipmapLevel(),kc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);const l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,i,s,l,a),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=mf(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Af(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodPlanes.length;e++)this._lodPlanes[e].dispose()}_cleanup(e){this._renderer.setRenderTarget(Fc,Nc,Oc),this._renderer.xr.enabled=kc,e.scissorTest=!1,za(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===xs||e.mapping===Ir?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Fc=this._renderer.getRenderTarget(),Nc=this._renderer.getActiveCubeFace(),Oc=this._renderer.getActiveMipmapLevel(),kc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const i=t||this._allocateTargets();return this._textureToCubeUV(e,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,i={magFilter:Jt,minFilter:Jt,generateMipmaps:!1,type:Ln,format:Ht,colorSpace:rn,depthBuffer:!1},s=pf(e,t,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=pf(e,t,i);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=Pb(r)),this._blurMaterial=Ub(r,e,t)}return s}_compileMaterial(e){const t=new Me(this._lodPlanes[0],e);this._renderer.compile(t,Uc)}_sceneToCubeUV(e,t,i,s,r){const l=new hn(90,1,t,i),c=[1,-1,1,1,1,1],u=[1,1,1,-1,-1,-1],h=this._renderer,d=h.autoClear,f=h.toneMapping;h.getClearColor(hf),h.toneMapping=Hi,h.autoClear=!1,h.state.buffers.depth.getReversed()&&(h.setRenderTarget(s),h.clearDepth(),h.setRenderTarget(null));const g=new dn({name:"PMREM.Background",side:Yt,depthWrite:!1,depthTest:!1}),m=new Me(new xn,g);let p=!1;const E=e.background;E?E.isColor&&(g.color.copy(E),e.background=null,p=!0):(g.color.copy(hf),p=!0);for(let v=0;v<6;v++){const _=v%3;_===0?(l.up.set(0,c[v],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+u[v],r.y,r.z)):_===1?(l.up.set(0,0,c[v]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+u[v],r.z)):(l.up.set(0,c[v],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+u[v]));const x=this._cubeSize;za(s,_*x,v>2?x:0,x,x),h.setRenderTarget(s),p&&h.render(m,l),h.render(e,l)}m.geometry.dispose(),m.material.dispose(),h.toneMapping=f,h.autoClear=d,e.background=E}_textureToCubeUV(e,t){const i=this._renderer,s=e.mapping===xs||e.mapping===Ir;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=mf()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Af());const r=s?this._cubemapMaterial:this._equirectMaterial,o=new Me(this._lodPlanes[0],r),a=r.uniforms;a.envMap.value=e;const l=this._cubeSize;za(t,0,0,3*l,2*l),i.setRenderTarget(t),i.render(o,Uc)}_applyPMREM(e){const t=this._renderer,i=t.autoClear;t.autoClear=!1;const s=this._lodPlanes.length;for(let r=1;r<s;r++){const o=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),a=df[(s-r-1)%df.length];this._blur(e,r-1,r,o,a)}t.autoClear=i}_blur(e,t,i,s,r){const o=this._pingPongRenderTarget;this._halfBlur(e,o,t,i,s,"latitudinal",r),this._halfBlur(o,e,i,i,s,"longitudinal",r)}_halfBlur(e,t,i,s,r,o,a){const l=this._renderer,c=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const u=3,h=new Me(this._lodPlanes[s],c),d=c.uniforms,f=this._sizeLods[i]-1,A=isFinite(r)?Math.PI/(2*f):2*Math.PI/(2*ls-1),g=r/A,m=isFinite(r)?1+Math.floor(u*g):ls;m>ls&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${ls}`);const p=[];let E=0;for(let I=0;I<ls;++I){const L=I/g,y=Math.exp(-L*L/2);p.push(y),I===0?E+=y:I<m&&(E+=2*y)}for(let I=0;I<p.length;I++)p[I]=p[I]/E;d.envMap.value=e.texture,d.samples.value=m,d.weights.value=p,d.latitudinal.value=o==="latitudinal",a&&(d.poleAxis.value=a);const{_lodMax:v}=this;d.dTheta.value=A,d.mipInt.value=v-i;const _=this._sizeLods[s],x=3*_*(s>v-pr?s-v+pr:0),S=4*(this._cubeSize-_);za(t,x,S,3*_,2*_),l.setRenderTarget(t),l.render(h,Uc)}}function Pb(n){const e=[],t=[],i=[];let s=n;const r=n-pr+1+uf.length;for(let o=0;o<r;o++){const a=Math.pow(2,s);t.push(a);let l=1/a;o>n-pr?l=uf[o-n+pr-1]:o===0&&(l=0),i.push(l);const c=1/(a-2),u=-c,h=1+c,d=[u,u,h,u,h,h,u,u,h,h,u,h],f=6,A=6,g=3,m=2,p=1,E=new Float32Array(g*A*f),v=new Float32Array(m*A*f),_=new Float32Array(p*A*f);for(let S=0;S<f;S++){const I=S%3*2/3-1,L=S>2?0:-1,y=[I,L,0,I+2/3,L,0,I+2/3,L+1,0,I,L,0,I+2/3,L+1,0,I,L+1,0];E.set(y,g*A*S),v.set(d,m*A*S);const b=[S,S,S,S,S,S];_.set(b,p*A*S)}const x=new mt;x.setAttribute("position",new it(E,g)),x.setAttribute("uv",new it(v,m)),x.setAttribute("faceIndex",new it(_,p)),e.push(x),s>pr&&s--}return{lodPlanes:e,sizeLods:t,sigmas:i}}function pf(n,e,t){const i=new ys(n,e,t);return i.texture.mapping=kl,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function za(n,e,t,i,s){n.viewport.set(e,t,i,s),n.scissor.set(e,t,i,s)}function Ub(n,e,t){const i=new Float32Array(ls),s=new w(0,1,0);return new Mn({name:"SphericalGaussianBlur",defines:{n:ls,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:zh(),fragmentShader:`

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
		`,blending:Qi,depthTest:!1,depthWrite:!1})}function Af(){return new Mn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:zh(),fragmentShader:`

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
		`,blending:Qi,depthTest:!1,depthWrite:!1})}function mf(){return new Mn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:zh(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Qi,depthTest:!1,depthWrite:!1})}function zh(){return`

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
	`}function Fb(n){let e=new WeakMap,t=null;function i(a){if(a&&a.isTexture){const l=a.mapping,c=l===Du||l===Pu,u=l===xs||l===Ir;if(c||u){let h=e.get(a);const d=h!==void 0?h.texture.pmremVersion:0;if(a.isRenderTargetTexture&&a.pmremVersion!==d)return t===null&&(t=new ff(n)),h=c?t.fromEquirectangular(a,h):t.fromCubemap(a,h),h.texture.pmremVersion=a.pmremVersion,e.set(a,h),h.texture;if(h!==void 0)return h.texture;{const f=a.image;return c&&f&&f.height>0||u&&f&&s(f)?(t===null&&(t=new ff(n)),h=c?t.fromEquirectangular(a):t.fromCubemap(a),h.texture.pmremVersion=a.pmremVersion,e.set(a,h),a.addEventListener("dispose",r),h.texture):null}}}return a}function s(a){let l=0;const c=6;for(let u=0;u<c;u++)a[u]!==void 0&&l++;return l===c}function r(a){const l=a.target;l.removeEventListener("dispose",r);const c=e.get(l);c!==void 0&&(e.delete(l),c.dispose())}function o(){e=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:i,dispose:o}}function Nb(n){const e={};function t(i){if(e[i]!==void 0)return e[i];let s;switch(i){case"WEBGL_depth_texture":s=n.getExtension("WEBGL_depth_texture")||n.getExtension("MOZ_WEBGL_depth_texture")||n.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":s=n.getExtension("EXT_texture_filter_anisotropic")||n.getExtension("MOZ_EXT_texture_filter_anisotropic")||n.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":s=n.getExtension("WEBGL_compressed_texture_s3tc")||n.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":s=n.getExtension("WEBGL_compressed_texture_pvrtc")||n.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:s=n.getExtension(i)}return e[i]=s,s}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){const s=t(i);return s===null&&Yo("THREE.WebGLRenderer: "+i+" extension not supported."),s}}}function Ob(n,e,t,i){const s={},r=new WeakMap;function o(h){const d=h.target;d.index!==null&&e.remove(d.index);for(const A in d.attributes)e.remove(d.attributes[A]);d.removeEventListener("dispose",o),delete s[d.id];const f=r.get(d);f&&(e.remove(f),r.delete(d)),i.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function a(h,d){return s[d.id]===!0||(d.addEventListener("dispose",o),s[d.id]=!0,t.memory.geometries++),d}function l(h){const d=h.attributes;for(const f in d)e.update(d[f],n.ARRAY_BUFFER)}function c(h){const d=[],f=h.index,A=h.attributes.position;let g=0;if(f!==null){const E=f.array;g=f.version;for(let v=0,_=E.length;v<_;v+=3){const x=E[v+0],S=E[v+1],I=E[v+2];d.push(x,S,S,I,I,x)}}else if(A!==void 0){const E=A.array;g=A.version;for(let v=0,_=E.length/3-1;v<_;v+=3){const x=v+0,S=v+1,I=v+2;d.push(x,S,S,I,I,x)}}else return;const m=new(vA(d)?SA:MA)(d,1);m.version=g;const p=r.get(h);p&&e.remove(p),r.set(h,m)}function u(h){const d=r.get(h);if(d){const f=h.index;f!==null&&d.version<f.version&&c(h)}else c(h);return r.get(h)}return{get:a,update:l,getWireframeAttribute:u}}function kb(n,e,t){let i;function s(d){i=d}let r,o;function a(d){r=d.type,o=d.bytesPerElement}function l(d,f){n.drawElements(i,f,r,d*o),t.update(f,i,1)}function c(d,f,A){A!==0&&(n.drawElementsInstanced(i,f,r,d*o,A),t.update(f,i,A))}function u(d,f,A){if(A===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,f,0,r,d,0,A);let m=0;for(let p=0;p<A;p++)m+=f[p];t.update(m,i,1)}function h(d,f,A,g){if(A===0)return;const m=e.get("WEBGL_multi_draw");if(m===null)for(let p=0;p<d.length;p++)c(d[p]/o,f[p],g[p]);else{m.multiDrawElementsInstancedWEBGL(i,f,0,r,d,0,g,0,A);let p=0;for(let E=0;E<A;E++)p+=f[E]*g[E];t.update(p,i,1)}}this.setMode=s,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=u,this.renderMultiDrawInstances=h}function Qb(n){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(r,o,a){switch(t.calls++,o){case n.TRIANGLES:t.triangles+=a*(r/3);break;case n.LINES:t.lines+=a*(r/2);break;case n.LINE_STRIP:t.lines+=a*(r-1);break;case n.LINE_LOOP:t.lines+=a*r;break;case n.POINTS:t.points+=a*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",o);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:i}}function Hb(n,e,t){const i=new WeakMap,s=new ft;function r(o,a,l){const c=o.morphTargetInfluences,u=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,h=u!==void 0?u.length:0;let d=i.get(a);if(d===void 0||d.count!==h){let y=function(){I.dispose(),i.delete(a),a.removeEventListener("dispose",y)};d!==void 0&&d.texture.dispose();const f=a.morphAttributes.position!==void 0,A=a.morphAttributes.normal!==void 0,g=a.morphAttributes.color!==void 0,m=a.morphAttributes.position||[],p=a.morphAttributes.normal||[],E=a.morphAttributes.color||[];let v=0;f===!0&&(v=1),A===!0&&(v=2),g===!0&&(v=3);let _=a.attributes.position.count*v,x=1;_>e.maxTextureSize&&(x=Math.ceil(_/e.maxTextureSize),_=e.maxTextureSize);const S=new Float32Array(_*x*4*h),I=new xA(S,_,x,h);I.type=sn,I.needsUpdate=!0;const L=v*4;for(let b=0;b<h;b++){const R=m[b],U=p[b],N=E[b],G=_*x*4*b;for(let V=0;V<R.count;V++){const P=V*L;f===!0&&(s.fromBufferAttribute(R,V),S[G+P+0]=s.x,S[G+P+1]=s.y,S[G+P+2]=s.z,S[G+P+3]=0),A===!0&&(s.fromBufferAttribute(U,V),S[G+P+4]=s.x,S[G+P+5]=s.y,S[G+P+6]=s.z,S[G+P+7]=0),g===!0&&(s.fromBufferAttribute(N,V),S[G+P+8]=s.x,S[G+P+9]=s.y,S[G+P+10]=s.z,S[G+P+11]=N.itemSize===4?s.w:1)}}d={count:h,texture:I,size:new ce(_,x)},i.set(a,d),a.addEventListener("dispose",y)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(n,"morphTexture",o.morphTexture,t);else{let f=0;for(let g=0;g<c.length;g++)f+=c[g];const A=a.morphTargetsRelative?1:1-f;l.getUniforms().setValue(n,"morphTargetBaseInfluence",A),l.getUniforms().setValue(n,"morphTargetInfluences",c)}l.getUniforms().setValue(n,"morphTargetsTexture",d.texture,t),l.getUniforms().setValue(n,"morphTargetsTextureSize",d.size)}return{update:r}}function Gb(n,e,t,i){let s=new WeakMap;function r(l){const c=i.render.frame,u=l.geometry,h=e.get(l,u);if(s.get(h)!==c&&(e.update(h),s.set(h,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",a)===!1&&l.addEventListener("dispose",a),s.get(l)!==c&&(t.update(l.instanceMatrix,n.ARRAY_BUFFER),l.instanceColor!==null&&t.update(l.instanceColor,n.ARRAY_BUFFER),s.set(l,c))),l.isSkinnedMesh){const d=l.skeleton;s.get(d)!==c&&(d.update(),s.set(d,c))}return h}function o(){s=new WeakMap}function a(l){const c=l.target;c.removeEventListener("dispose",a),t.remove(c.instanceMatrix),c.instanceColor!==null&&t.remove(c.instanceColor)}return{update:r,dispose:o}}const tm=new Qt,gf=new FA(1,1),nm=new xA,im=new EA,sm=new TA,_f=[],vf=[],xf=new Float32Array(16),Ef=new Float32Array(9),bf=new Float32Array(4);function Wr(n,e,t){const i=n[0];if(i<=0||i>0)return n;const s=e*t;let r=_f[s];if(r===void 0&&(r=new Float32Array(s),_f[s]=r),e!==0){i.toArray(r,0);for(let o=1,a=0;o!==e;++o)a+=t,n[o].toArray(r,a)}return r}function zt(n,e){if(n.length!==e.length)return!1;for(let t=0,i=n.length;t<i;t++)if(n[t]!==e[t])return!1;return!0}function Vt(n,e){for(let t=0,i=e.length;t<i;t++)n[t]=e[t]}function Yl(n,e){let t=vf[e];t===void 0&&(t=new Int32Array(e),vf[e]=t);for(let i=0;i!==e;++i)t[i]=n.allocateTextureUnit();return t}function zb(n,e){const t=this.cache;t[0]!==e&&(n.uniform1f(this.addr,e),t[0]=e)}function Vb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(zt(t,e))return;n.uniform2fv(this.addr,e),Vt(t,e)}}function Wb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(n.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(zt(t,e))return;n.uniform3fv(this.addr,e),Vt(t,e)}}function qb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(zt(t,e))return;n.uniform4fv(this.addr,e),Vt(t,e)}}function Xb(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(zt(t,e))return;n.uniformMatrix2fv(this.addr,!1,e),Vt(t,e)}else{if(zt(t,i))return;bf.set(i),n.uniformMatrix2fv(this.addr,!1,bf),Vt(t,i)}}function Yb(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(zt(t,e))return;n.uniformMatrix3fv(this.addr,!1,e),Vt(t,e)}else{if(zt(t,i))return;Ef.set(i),n.uniformMatrix3fv(this.addr,!1,Ef),Vt(t,i)}}function jb(n,e){const t=this.cache,i=e.elements;if(i===void 0){if(zt(t,e))return;n.uniformMatrix4fv(this.addr,!1,e),Vt(t,e)}else{if(zt(t,i))return;xf.set(i),n.uniformMatrix4fv(this.addr,!1,xf),Vt(t,i)}}function Jb(n,e){const t=this.cache;t[0]!==e&&(n.uniform1i(this.addr,e),t[0]=e)}function Kb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(zt(t,e))return;n.uniform2iv(this.addr,e),Vt(t,e)}}function Zb(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(zt(t,e))return;n.uniform3iv(this.addr,e),Vt(t,e)}}function $b(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(zt(t,e))return;n.uniform4iv(this.addr,e),Vt(t,e)}}function ey(n,e){const t=this.cache;t[0]!==e&&(n.uniform1ui(this.addr,e),t[0]=e)}function ty(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(n.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(zt(t,e))return;n.uniform2uiv(this.addr,e),Vt(t,e)}}function ny(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(n.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(zt(t,e))return;n.uniform3uiv(this.addr,e),Vt(t,e)}}function iy(n,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(n.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(zt(t,e))return;n.uniform4uiv(this.addr,e),Vt(t,e)}}function sy(n,e,t){const i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s);let r;this.type===n.SAMPLER_2D_SHADOW?(gf.compareFunction=_A,r=gf):r=tm,t.setTexture2D(e||r,s)}function ry(n,e,t){const i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s),t.setTexture3D(e||im,s)}function oy(n,e,t){const i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s),t.setTextureCube(e||sm,s)}function ay(n,e,t){const i=this.cache,s=t.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s),t.setTexture2DArray(e||nm,s)}function ly(n){switch(n){case 5126:return zb;case 35664:return Vb;case 35665:return Wb;case 35666:return qb;case 35674:return Xb;case 35675:return Yb;case 35676:return jb;case 5124:case 35670:return Jb;case 35667:case 35671:return Kb;case 35668:case 35672:return Zb;case 35669:case 35673:return $b;case 5125:return ey;case 36294:return ty;case 36295:return ny;case 36296:return iy;case 35678:case 36198:case 36298:case 36306:case 35682:return sy;case 35679:case 36299:case 36307:return ry;case 35680:case 36300:case 36308:case 36293:return oy;case 36289:case 36303:case 36311:case 36292:return ay}}function cy(n,e){n.uniform1fv(this.addr,e)}function uy(n,e){const t=Wr(e,this.size,2);n.uniform2fv(this.addr,t)}function hy(n,e){const t=Wr(e,this.size,3);n.uniform3fv(this.addr,t)}function dy(n,e){const t=Wr(e,this.size,4);n.uniform4fv(this.addr,t)}function fy(n,e){const t=Wr(e,this.size,4);n.uniformMatrix2fv(this.addr,!1,t)}function py(n,e){const t=Wr(e,this.size,9);n.uniformMatrix3fv(this.addr,!1,t)}function Ay(n,e){const t=Wr(e,this.size,16);n.uniformMatrix4fv(this.addr,!1,t)}function my(n,e){n.uniform1iv(this.addr,e)}function gy(n,e){n.uniform2iv(this.addr,e)}function _y(n,e){n.uniform3iv(this.addr,e)}function vy(n,e){n.uniform4iv(this.addr,e)}function xy(n,e){n.uniform1uiv(this.addr,e)}function Ey(n,e){n.uniform2uiv(this.addr,e)}function by(n,e){n.uniform3uiv(this.addr,e)}function yy(n,e){n.uniform4uiv(this.addr,e)}function My(n,e,t){const i=this.cache,s=e.length,r=Yl(t,s);zt(i,r)||(n.uniform1iv(this.addr,r),Vt(i,r));for(let o=0;o!==s;++o)t.setTexture2D(e[o]||tm,r[o])}function Sy(n,e,t){const i=this.cache,s=e.length,r=Yl(t,s);zt(i,r)||(n.uniform1iv(this.addr,r),Vt(i,r));for(let o=0;o!==s;++o)t.setTexture3D(e[o]||im,r[o])}function wy(n,e,t){const i=this.cache,s=e.length,r=Yl(t,s);zt(i,r)||(n.uniform1iv(this.addr,r),Vt(i,r));for(let o=0;o!==s;++o)t.setTextureCube(e[o]||sm,r[o])}function Cy(n,e,t){const i=this.cache,s=e.length,r=Yl(t,s);zt(i,r)||(n.uniform1iv(this.addr,r),Vt(i,r));for(let o=0;o!==s;++o)t.setTexture2DArray(e[o]||nm,r[o])}function Iy(n){switch(n){case 5126:return cy;case 35664:return uy;case 35665:return hy;case 35666:return dy;case 35674:return fy;case 35675:return py;case 35676:return Ay;case 5124:case 35670:return my;case 35667:case 35671:return gy;case 35668:case 35672:return _y;case 35669:case 35673:return vy;case 5125:return xy;case 36294:return Ey;case 36295:return by;case 36296:return yy;case 35678:case 36198:case 36298:case 36306:case 35682:return My;case 35679:case 36299:case 36307:return Sy;case 35680:case 36300:case 36308:case 36293:return wy;case 36289:case 36303:case 36311:case 36292:return Cy}}class Ty{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.setValue=ly(t.type)}}class Ry{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Iy(t.type)}}class By{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,i){const s=this.seq;for(let r=0,o=s.length;r!==o;++r){const a=s[r];a.setValue(e,t[a.id],i)}}}const Qc=/(\w+)(\])?(\[|\.)?/g;function yf(n,e){n.seq.push(e),n.map[e.id]=e}function Ly(n,e,t){const i=n.name,s=i.length;for(Qc.lastIndex=0;;){const r=Qc.exec(i),o=Qc.lastIndex;let a=r[1];const l=r[2]==="]",c=r[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===s){yf(t,c===void 0?new Ty(a,n,e):new Ry(a,n,e));break}else{let h=t.map[a];h===void 0&&(h=new By(a),yf(t,h)),t=h}}}class ol{constructor(e,t){this.seq=[],this.map={};const i=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let s=0;s<i;++s){const r=e.getActiveUniform(t,s),o=e.getUniformLocation(t,r.name);Ly(r,o,this)}}setValue(e,t,i,s){const r=this.map[t];r!==void 0&&r.setValue(e,i,s)}setOptional(e,t,i){const s=t[i];s!==void 0&&this.setValue(e,i,s)}static upload(e,t,i,s){for(let r=0,o=t.length;r!==o;++r){const a=t[r],l=i[a.id];l.needsUpdate!==!1&&a.setValue(e,l.value,s)}}static seqWithValue(e,t){const i=[];for(let s=0,r=e.length;s!==r;++s){const o=e[s];o.id in t&&i.push(o)}return i}}function Mf(n,e,t){const i=n.createShader(e);return n.shaderSource(i,t),n.compileShader(i),i}const Dy=37297;let Py=0;function Uy(n,e){const t=n.split(`
`),i=[],s=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let o=s;o<r;o++){const a=o+1;i.push(`${a===e?">":" "} ${a}: ${t[o]}`)}return i.join(`
`)}const Sf=new ze;function Fy(n){lt._getMatrix(Sf,lt.workingColorSpace,n);const e=`mat3( ${Sf.elements.map(t=>t.toFixed(4))} )`;switch(lt.getTransfer(n)){case Ml:return[e,"LinearTransferOETF"];case Et:return[e,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",n),[e,"LinearTransferOETF"]}}function wf(n,e,t){const i=n.getShaderParameter(e,n.COMPILE_STATUS),r=(n.getShaderInfoLog(e)||"").trim();if(i&&r==="")return"";const o=/ERROR: 0:(\d+)/.exec(r);if(o){const a=parseInt(o[1]);return t.toUpperCase()+`

`+r+`

`+Uy(n.getShaderSource(e),a)}else return r}function Ny(n,e){const t=Fy(e);return[`vec4 ${n}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}function Oy(n,e){let t;switch(e){case v0:t="Linear";break;case x0:t="Reinhard";break;case E0:t="Cineon";break;case dA:t="ACESFilmic";break;case y0:t="AgX";break;case M0:t="Neutral";break;case b0:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",e),t="Linear"}return"vec3 "+n+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const Va=new w;function ky(){lt.getLuminanceCoefficients(Va);const n=Va.x.toFixed(4),e=Va.y.toFixed(4),t=Va.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${n}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Qy(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(yo).join(`
`)}function Hy(n){const e=[];for(const t in n){const i=n[t];i!==!1&&e.push("#define "+t+" "+i)}return e.join(`
`)}function Gy(n,e){const t={},i=n.getProgramParameter(e,n.ACTIVE_ATTRIBUTES);for(let s=0;s<i;s++){const r=n.getActiveAttrib(e,s),o=r.name;let a=1;r.type===n.FLOAT_MAT2&&(a=2),r.type===n.FLOAT_MAT3&&(a=3),r.type===n.FLOAT_MAT4&&(a=4),t[o]={type:r.type,location:n.getAttribLocation(e,o),locationSize:a}}return t}function yo(n){return n!==""}function Cf(n,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return n.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function If(n,e){return n.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const zy=/^[ \t]*#include +<([\w\d./]+)>/gm;function nh(n){return n.replace(zy,Wy)}const Vy=new Map;function Wy(n,e){let t=et[e];if(t===void 0){const i=Vy.get(e);if(i!==void 0)t=et[i],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,i);else throw new Error("Can not resolve #include <"+e+">")}return nh(t)}const qy=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Tf(n){return n.replace(qy,Xy)}function Xy(n,e,t,i){let s="";for(let r=parseInt(e);r<parseInt(t);r++)s+=i.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function Rf(n){let e=`precision ${n.precision} float;
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
#define LOW_PRECISION`),e}function Yy(n){let e="SHADOWMAP_TYPE_BASIC";return n.shadowMapType===uA?e="SHADOWMAP_TYPE_PCF":n.shadowMapType===hA?e="SHADOWMAP_TYPE_PCF_SOFT":n.shadowMapType===gi&&(e="SHADOWMAP_TYPE_VSM"),e}function jy(n){let e="ENVMAP_TYPE_CUBE";if(n.envMap)switch(n.envMapMode){case xs:case Ir:e="ENVMAP_TYPE_CUBE";break;case kl:e="ENVMAP_TYPE_CUBE_UV";break}return e}function Jy(n){let e="ENVMAP_MODE_REFLECTION";if(n.envMap)switch(n.envMapMode){case Ir:e="ENVMAP_MODE_REFRACTION";break}return e}function Ky(n){let e="ENVMAP_BLENDING_NONE";if(n.envMap)switch(n.combine){case vh:e="ENVMAP_BLENDING_MULTIPLY";break;case g0:e="ENVMAP_BLENDING_MIX";break;case _0:e="ENVMAP_BLENDING_ADD";break}return e}function Zy(n){const e=n.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,i=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:i,maxMip:t}}function $y(n,e,t,i){const s=n.getContext(),r=t.defines;let o=t.vertexShader,a=t.fragmentShader;const l=Yy(t),c=jy(t),u=Jy(t),h=Ky(t),d=Zy(t),f=Qy(t),A=Hy(r),g=s.createProgram();let m,p,E=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,A].filter(yo).join(`
`),m.length>0&&(m+=`
`),p=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,A].filter(yo).join(`
`),p.length>0&&(p+=`
`)):(m=[Rf(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,A,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+u:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(yo).join(`
`),p=[Rf(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,A,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+u:"",t.envMap?"#define "+h:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor||t.batchingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Hi?"#define TONE_MAPPING":"",t.toneMapping!==Hi?et.tonemapping_pars_fragment:"",t.toneMapping!==Hi?Oy("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",et.colorspace_pars_fragment,Ny("linearToOutputTexel",t.outputColorSpace),ky(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(yo).join(`
`)),o=nh(o),o=Cf(o,t),o=If(o,t),a=nh(a),a=Cf(a,t),a=If(a,t),o=Tf(o),a=Tf(a),t.isRawShaderMaterial!==!0&&(E=`#version 300 es
`,m=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,p=["#define varying in",t.glslVersion===gd?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===gd?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);const v=E+m+o,_=E+p+a,x=Mf(s,s.VERTEX_SHADER,v),S=Mf(s,s.FRAGMENT_SHADER,_);s.attachShader(g,x),s.attachShader(g,S),t.index0AttributeName!==void 0?s.bindAttribLocation(g,0,t.index0AttributeName):t.morphTargets===!0&&s.bindAttribLocation(g,0,"position"),s.linkProgram(g);function I(R){if(n.debug.checkShaderErrors){const U=s.getProgramInfoLog(g)||"",N=s.getShaderInfoLog(x)||"",G=s.getShaderInfoLog(S)||"",V=U.trim(),P=N.trim(),Y=G.trim();let H=!0,te=!0;if(s.getProgramParameter(g,s.LINK_STATUS)===!1)if(H=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(s,g,x,S);else{const se=wf(s,x,"vertex"),ae=wf(s,S,"fragment");console.error("THREE.WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(g,s.VALIDATE_STATUS)+`

Material Name: `+R.name+`
Material Type: `+R.type+`

Program Info Log: `+V+`
`+se+`
`+ae)}else V!==""?console.warn("THREE.WebGLProgram: Program Info Log:",V):(P===""||Y==="")&&(te=!1);te&&(R.diagnostics={runnable:H,programLog:V,vertexShader:{log:P,prefix:m},fragmentShader:{log:Y,prefix:p}})}s.deleteShader(x),s.deleteShader(S),L=new ol(s,g),y=Gy(s,g)}let L;this.getUniforms=function(){return L===void 0&&I(this),L};let y;this.getAttributes=function(){return y===void 0&&I(this),y};let b=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return b===!1&&(b=s.getProgramParameter(g,Dy)),b},this.destroy=function(){i.releaseStatesOfProgram(this),s.deleteProgram(g),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Py++,this.cacheKey=e,this.usedTimes=1,this.program=g,this.vertexShader=x,this.fragmentShader=S,this}let eM=0;class tM{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){const t=e.vertexShader,i=e.fragmentShader,s=this._getShaderStage(t),r=this._getShaderStage(i),o=this._getShaderCacheForMaterial(e);return o.has(s)===!1&&(o.add(s),s.usedTimes++),o.has(r)===!1&&(o.add(r),r.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let i=t.get(e);return i===void 0&&(i=new Set,t.set(e,i)),i}_getShaderStage(e){const t=this.shaderCache;let i=t.get(e);return i===void 0&&(i=new nM(e),t.set(e,i)),i}}class nM{constructor(e){this.id=eM++,this.code=e,this.usedTimes=0}}function iM(n,e,t,i,s,r,o){const a=new bA,l=new tM,c=new Set,u=[],h=s.logarithmicDepthBuffer,d=s.vertexTextures;let f=s.precision;const A={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(y){return c.add(y),y===0?"uv":`uv${y}`}function m(y,b,R,U,N){const G=U.fog,V=N.geometry,P=y.isMeshStandardMaterial?U.environment:null,Y=(y.isMeshStandardMaterial?t:e).get(y.envMap||P),H=Y&&Y.mapping===kl?Y.image.height:null,te=A[y.type];y.precision!==null&&(f=s.getMaxPrecision(y.precision),f!==y.precision&&console.warn("THREE.WebGLProgram.getParameters:",y.precision,"not supported, using",f,"instead."));const se=V.morphAttributes.position||V.morphAttributes.normal||V.morphAttributes.color,ae=se!==void 0?se.length:0;let ve=0;V.morphAttributes.position!==void 0&&(ve=1),V.morphAttributes.normal!==void 0&&(ve=2),V.morphAttributes.color!==void 0&&(ve=3);let Oe,Ke,$e,K;if(te){const ut=ei[te];Oe=ut.vertexShader,Ke=ut.fragmentShader}else Oe=y.vertexShader,Ke=y.fragmentShader,l.update(y),$e=l.getVertexShaderID(y),K=l.getFragmentShaderID(y);const ne=n.getRenderTarget(),be=n.state.buffers.depth.getReversed(),Le=N.isInstancedMesh===!0,Se=N.isBatchedMesh===!0,re=!!y.map,Ie=!!y.matcap,B=!!Y,$=!!y.aoMap,j=!!y.lightMap,q=!!y.bumpMap,Z=!!y.normalMap,Ae=!!y.displacementMap,oe=!!y.emissiveMap,pe=!!y.metalnessMap,We=!!y.roughnessMap,Xe=y.anisotropy>0,T=y.clearcoat>0,M=y.dispersion>0,k=y.iridescence>0,X=y.sheen>0,ie=y.transmission>0,J=Xe&&!!y.anisotropyMap,De=T&&!!y.clearcoatMap,he=T&&!!y.clearcoatNormalMap,Be=T&&!!y.clearcoatRoughnessMap,Te=k&&!!y.iridescenceMap,ue=k&&!!y.iridescenceThicknessMap,xe=X&&!!y.sheenColorMap,He=X&&!!y.sheenRoughnessMap,Fe=!!y.specularMap,_e=!!y.specularColorMap,Je=!!y.specularIntensityMap,D=ie&&!!y.transmissionMap,de=ie&&!!y.thicknessMap,me=!!y.gradientMap,we=!!y.alphaMap,le=y.alphaTest>0,ee=!!y.alphaHash,Re=!!y.extensions;let Ye=Hi;y.toneMapped&&(ne===null||ne.isXRRenderTarget===!0)&&(Ye=n.toneMapping);const At={shaderID:te,shaderType:y.type,shaderName:y.name,vertexShader:Oe,fragmentShader:Ke,defines:y.defines,customVertexShaderID:$e,customFragmentShaderID:K,isRawShaderMaterial:y.isRawShaderMaterial===!0,glslVersion:y.glslVersion,precision:f,batching:Se,batchingColor:Se&&N._colorsTexture!==null,instancing:Le,instancingColor:Le&&N.instanceColor!==null,instancingMorph:Le&&N.morphTexture!==null,supportsVertexTextures:d,outputColorSpace:ne===null?n.outputColorSpace:ne.isXRRenderTarget===!0?ne.texture.colorSpace:rn,alphaToCoverage:!!y.alphaToCoverage,map:re,matcap:Ie,envMap:B,envMapMode:B&&Y.mapping,envMapCubeUVHeight:H,aoMap:$,lightMap:j,bumpMap:q,normalMap:Z,displacementMap:d&&Ae,emissiveMap:oe,normalMapObjectSpace:Z&&y.normalMapType===R0,normalMapTangentSpace:Z&&y.normalMapType===na,metalnessMap:pe,roughnessMap:We,anisotropy:Xe,anisotropyMap:J,clearcoat:T,clearcoatMap:De,clearcoatNormalMap:he,clearcoatRoughnessMap:Be,dispersion:M,iridescence:k,iridescenceMap:Te,iridescenceThicknessMap:ue,sheen:X,sheenColorMap:xe,sheenRoughnessMap:He,specularMap:Fe,specularColorMap:_e,specularIntensityMap:Je,transmission:ie,transmissionMap:D,thicknessMap:de,gradientMap:me,opaque:y.transparent===!1&&y.blending===_r&&y.alphaToCoverage===!1,alphaMap:we,alphaTest:le,alphaHash:ee,combine:y.combine,mapUv:re&&g(y.map.channel),aoMapUv:$&&g(y.aoMap.channel),lightMapUv:j&&g(y.lightMap.channel),bumpMapUv:q&&g(y.bumpMap.channel),normalMapUv:Z&&g(y.normalMap.channel),displacementMapUv:Ae&&g(y.displacementMap.channel),emissiveMapUv:oe&&g(y.emissiveMap.channel),metalnessMapUv:pe&&g(y.metalnessMap.channel),roughnessMapUv:We&&g(y.roughnessMap.channel),anisotropyMapUv:J&&g(y.anisotropyMap.channel),clearcoatMapUv:De&&g(y.clearcoatMap.channel),clearcoatNormalMapUv:he&&g(y.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Be&&g(y.clearcoatRoughnessMap.channel),iridescenceMapUv:Te&&g(y.iridescenceMap.channel),iridescenceThicknessMapUv:ue&&g(y.iridescenceThicknessMap.channel),sheenColorMapUv:xe&&g(y.sheenColorMap.channel),sheenRoughnessMapUv:He&&g(y.sheenRoughnessMap.channel),specularMapUv:Fe&&g(y.specularMap.channel),specularColorMapUv:_e&&g(y.specularColorMap.channel),specularIntensityMapUv:Je&&g(y.specularIntensityMap.channel),transmissionMapUv:D&&g(y.transmissionMap.channel),thicknessMapUv:de&&g(y.thicknessMap.channel),alphaMapUv:we&&g(y.alphaMap.channel),vertexTangents:!!V.attributes.tangent&&(Z||Xe),vertexColors:y.vertexColors,vertexAlphas:y.vertexColors===!0&&!!V.attributes.color&&V.attributes.color.itemSize===4,pointsUvs:N.isPoints===!0&&!!V.attributes.uv&&(re||we),fog:!!G,useFog:y.fog===!0,fogExp2:!!G&&G.isFogExp2,flatShading:y.flatShading===!0&&y.wireframe===!1,sizeAttenuation:y.sizeAttenuation===!0,logarithmicDepthBuffer:h,reversedDepthBuffer:be,skinning:N.isSkinnedMesh===!0,morphTargets:V.morphAttributes.position!==void 0,morphNormals:V.morphAttributes.normal!==void 0,morphColors:V.morphAttributes.color!==void 0,morphTargetsCount:ae,morphTextureStride:ve,numDirLights:b.directional.length,numPointLights:b.point.length,numSpotLights:b.spot.length,numSpotLightMaps:b.spotLightMap.length,numRectAreaLights:b.rectArea.length,numHemiLights:b.hemi.length,numDirLightShadows:b.directionalShadowMap.length,numPointLightShadows:b.pointShadowMap.length,numSpotLightShadows:b.spotShadowMap.length,numSpotLightShadowsWithMaps:b.numSpotLightShadowsWithMaps,numLightProbes:b.numLightProbes,numClippingPlanes:o.numPlanes,numClipIntersection:o.numIntersection,dithering:y.dithering,shadowMapEnabled:n.shadowMap.enabled&&R.length>0,shadowMapType:n.shadowMap.type,toneMapping:Ye,decodeVideoTexture:re&&y.map.isVideoTexture===!0&&lt.getTransfer(y.map.colorSpace)===Et,decodeVideoTextureEmissive:oe&&y.emissiveMap.isVideoTexture===!0&&lt.getTransfer(y.emissiveMap.colorSpace)===Et,premultipliedAlpha:y.premultipliedAlpha,doubleSided:y.side===nn,flipSided:y.side===Yt,useDepthPacking:y.depthPacking>=0,depthPacking:y.depthPacking||0,index0AttributeName:y.index0AttributeName,extensionClipCullDistance:Re&&y.extensions.clipCullDistance===!0&&i.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Re&&y.extensions.multiDraw===!0||Se)&&i.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:i.has("KHR_parallel_shader_compile"),customProgramCacheKey:y.customProgramCacheKey()};return At.vertexUv1s=c.has(1),At.vertexUv2s=c.has(2),At.vertexUv3s=c.has(3),c.clear(),At}function p(y){const b=[];if(y.shaderID?b.push(y.shaderID):(b.push(y.customVertexShaderID),b.push(y.customFragmentShaderID)),y.defines!==void 0)for(const R in y.defines)b.push(R),b.push(y.defines[R]);return y.isRawShaderMaterial===!1&&(E(b,y),v(b,y),b.push(n.outputColorSpace)),b.push(y.customProgramCacheKey),b.join()}function E(y,b){y.push(b.precision),y.push(b.outputColorSpace),y.push(b.envMapMode),y.push(b.envMapCubeUVHeight),y.push(b.mapUv),y.push(b.alphaMapUv),y.push(b.lightMapUv),y.push(b.aoMapUv),y.push(b.bumpMapUv),y.push(b.normalMapUv),y.push(b.displacementMapUv),y.push(b.emissiveMapUv),y.push(b.metalnessMapUv),y.push(b.roughnessMapUv),y.push(b.anisotropyMapUv),y.push(b.clearcoatMapUv),y.push(b.clearcoatNormalMapUv),y.push(b.clearcoatRoughnessMapUv),y.push(b.iridescenceMapUv),y.push(b.iridescenceThicknessMapUv),y.push(b.sheenColorMapUv),y.push(b.sheenRoughnessMapUv),y.push(b.specularMapUv),y.push(b.specularColorMapUv),y.push(b.specularIntensityMapUv),y.push(b.transmissionMapUv),y.push(b.thicknessMapUv),y.push(b.combine),y.push(b.fogExp2),y.push(b.sizeAttenuation),y.push(b.morphTargetsCount),y.push(b.morphAttributeCount),y.push(b.numDirLights),y.push(b.numPointLights),y.push(b.numSpotLights),y.push(b.numSpotLightMaps),y.push(b.numHemiLights),y.push(b.numRectAreaLights),y.push(b.numDirLightShadows),y.push(b.numPointLightShadows),y.push(b.numSpotLightShadows),y.push(b.numSpotLightShadowsWithMaps),y.push(b.numLightProbes),y.push(b.shadowMapType),y.push(b.toneMapping),y.push(b.numClippingPlanes),y.push(b.numClipIntersection),y.push(b.depthPacking)}function v(y,b){a.disableAll(),b.supportsVertexTextures&&a.enable(0),b.instancing&&a.enable(1),b.instancingColor&&a.enable(2),b.instancingMorph&&a.enable(3),b.matcap&&a.enable(4),b.envMap&&a.enable(5),b.normalMapObjectSpace&&a.enable(6),b.normalMapTangentSpace&&a.enable(7),b.clearcoat&&a.enable(8),b.iridescence&&a.enable(9),b.alphaTest&&a.enable(10),b.vertexColors&&a.enable(11),b.vertexAlphas&&a.enable(12),b.vertexUv1s&&a.enable(13),b.vertexUv2s&&a.enable(14),b.vertexUv3s&&a.enable(15),b.vertexTangents&&a.enable(16),b.anisotropy&&a.enable(17),b.alphaHash&&a.enable(18),b.batching&&a.enable(19),b.dispersion&&a.enable(20),b.batchingColor&&a.enable(21),b.gradientMap&&a.enable(22),y.push(a.mask),a.disableAll(),b.fog&&a.enable(0),b.useFog&&a.enable(1),b.flatShading&&a.enable(2),b.logarithmicDepthBuffer&&a.enable(3),b.reversedDepthBuffer&&a.enable(4),b.skinning&&a.enable(5),b.morphTargets&&a.enable(6),b.morphNormals&&a.enable(7),b.morphColors&&a.enable(8),b.premultipliedAlpha&&a.enable(9),b.shadowMapEnabled&&a.enable(10),b.doubleSided&&a.enable(11),b.flipSided&&a.enable(12),b.useDepthPacking&&a.enable(13),b.dithering&&a.enable(14),b.transmission&&a.enable(15),b.sheen&&a.enable(16),b.opaque&&a.enable(17),b.pointsUvs&&a.enable(18),b.decodeVideoTexture&&a.enable(19),b.decodeVideoTextureEmissive&&a.enable(20),b.alphaToCoverage&&a.enable(21),y.push(a.mask)}function _(y){const b=A[y.type];let R;if(b){const U=ei[b];R=CA.clone(U.uniforms)}else R=y.uniforms;return R}function x(y,b){let R;for(let U=0,N=u.length;U<N;U++){const G=u[U];if(G.cacheKey===b){R=G,++R.usedTimes;break}}return R===void 0&&(R=new $y(n,b,y,r),u.push(R)),R}function S(y){if(--y.usedTimes===0){const b=u.indexOf(y);u[b]=u[u.length-1],u.pop(),y.destroy()}}function I(y){l.remove(y)}function L(){l.dispose()}return{getParameters:m,getProgramCacheKey:p,getUniforms:_,acquireProgram:x,releaseProgram:S,releaseShaderCache:I,programs:u,dispose:L}}function sM(){let n=new WeakMap;function e(o){return n.has(o)}function t(o){let a=n.get(o);return a===void 0&&(a={},n.set(o,a)),a}function i(o){n.delete(o)}function s(o,a,l){n.get(o)[a]=l}function r(){n=new WeakMap}return{has:e,get:t,remove:i,update:s,dispose:r}}function rM(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.material.id!==e.material.id?n.material.id-e.material.id:n.z!==e.z?n.z-e.z:n.id-e.id}function Bf(n,e){return n.groupOrder!==e.groupOrder?n.groupOrder-e.groupOrder:n.renderOrder!==e.renderOrder?n.renderOrder-e.renderOrder:n.z!==e.z?e.z-n.z:n.id-e.id}function Lf(){const n=[];let e=0;const t=[],i=[],s=[];function r(){e=0,t.length=0,i.length=0,s.length=0}function o(h,d,f,A,g,m){let p=n[e];return p===void 0?(p={id:h.id,object:h,geometry:d,material:f,groupOrder:A,renderOrder:h.renderOrder,z:g,group:m},n[e]=p):(p.id=h.id,p.object=h,p.geometry=d,p.material=f,p.groupOrder=A,p.renderOrder=h.renderOrder,p.z=g,p.group=m),e++,p}function a(h,d,f,A,g,m){const p=o(h,d,f,A,g,m);f.transmission>0?i.push(p):f.transparent===!0?s.push(p):t.push(p)}function l(h,d,f,A,g,m){const p=o(h,d,f,A,g,m);f.transmission>0?i.unshift(p):f.transparent===!0?s.unshift(p):t.unshift(p)}function c(h,d){t.length>1&&t.sort(h||rM),i.length>1&&i.sort(d||Bf),s.length>1&&s.sort(d||Bf)}function u(){for(let h=e,d=n.length;h<d;h++){const f=n[h];if(f.id===null)break;f.id=null,f.object=null,f.geometry=null,f.material=null,f.group=null}}return{opaque:t,transmissive:i,transparent:s,init:r,push:a,unshift:l,finish:u,sort:c}}function oM(){let n=new WeakMap;function e(i,s){const r=n.get(i);let o;return r===void 0?(o=new Lf,n.set(i,[o])):s>=r.length?(o=new Lf,r.push(o)):o=r[s],o}function t(){n=new WeakMap}return{get:e,dispose:t}}function aM(){const n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new w,color:new ye};break;case"SpotLight":t={position:new w,direction:new w,color:new ye,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new w,color:new ye,distance:0,decay:0};break;case"HemisphereLight":t={direction:new w,skyColor:new ye,groundColor:new ye};break;case"RectAreaLight":t={color:new ye,position:new w,halfWidth:new w,halfHeight:new w};break}return n[e.id]=t,t}}}function lM(){const n={};return{get:function(e){if(n[e.id]!==void 0)return n[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ce};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ce};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ce,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[e.id]=t,t}}}let cM=0;function uM(n,e){return(e.castShadow?2:0)-(n.castShadow?2:0)+(e.map?1:0)-(n.map?1:0)}function hM(n){const e=new aM,t=lM(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new w);const s=new w,r=new Qe,o=new Qe;function a(c){let u=0,h=0,d=0;for(let y=0;y<9;y++)i.probe[y].set(0,0,0);let f=0,A=0,g=0,m=0,p=0,E=0,v=0,_=0,x=0,S=0,I=0;c.sort(uM);for(let y=0,b=c.length;y<b;y++){const R=c[y],U=R.color,N=R.intensity,G=R.distance,V=R.shadow&&R.shadow.map?R.shadow.map.texture:null;if(R.isAmbientLight)u+=U.r*N,h+=U.g*N,d+=U.b*N;else if(R.isLightProbe){for(let P=0;P<9;P++)i.probe[P].addScaledVector(R.sh.coefficients[P],N);I++}else if(R.isDirectionalLight){const P=e.get(R);if(P.color.copy(R.color).multiplyScalar(R.intensity),R.castShadow){const Y=R.shadow,H=t.get(R);H.shadowIntensity=Y.intensity,H.shadowBias=Y.bias,H.shadowNormalBias=Y.normalBias,H.shadowRadius=Y.radius,H.shadowMapSize=Y.mapSize,i.directionalShadow[f]=H,i.directionalShadowMap[f]=V,i.directionalShadowMatrix[f]=R.shadow.matrix,E++}i.directional[f]=P,f++}else if(R.isSpotLight){const P=e.get(R);P.position.setFromMatrixPosition(R.matrixWorld),P.color.copy(U).multiplyScalar(N),P.distance=G,P.coneCos=Math.cos(R.angle),P.penumbraCos=Math.cos(R.angle*(1-R.penumbra)),P.decay=R.decay,i.spot[g]=P;const Y=R.shadow;if(R.map&&(i.spotLightMap[x]=R.map,x++,Y.updateMatrices(R),R.castShadow&&S++),i.spotLightMatrix[g]=Y.matrix,R.castShadow){const H=t.get(R);H.shadowIntensity=Y.intensity,H.shadowBias=Y.bias,H.shadowNormalBias=Y.normalBias,H.shadowRadius=Y.radius,H.shadowMapSize=Y.mapSize,i.spotShadow[g]=H,i.spotShadowMap[g]=V,_++}g++}else if(R.isRectAreaLight){const P=e.get(R);P.color.copy(U).multiplyScalar(N),P.halfWidth.set(R.width*.5,0,0),P.halfHeight.set(0,R.height*.5,0),i.rectArea[m]=P,m++}else if(R.isPointLight){const P=e.get(R);if(P.color.copy(R.color).multiplyScalar(R.intensity),P.distance=R.distance,P.decay=R.decay,R.castShadow){const Y=R.shadow,H=t.get(R);H.shadowIntensity=Y.intensity,H.shadowBias=Y.bias,H.shadowNormalBias=Y.normalBias,H.shadowRadius=Y.radius,H.shadowMapSize=Y.mapSize,H.shadowCameraNear=Y.camera.near,H.shadowCameraFar=Y.camera.far,i.pointShadow[A]=H,i.pointShadowMap[A]=V,i.pointShadowMatrix[A]=R.shadow.matrix,v++}i.point[A]=P,A++}else if(R.isHemisphereLight){const P=e.get(R);P.skyColor.copy(R.color).multiplyScalar(N),P.groundColor.copy(R.groundColor).multiplyScalar(N),i.hemi[p]=P,p++}}m>0&&(n.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=ge.LTC_FLOAT_1,i.rectAreaLTC2=ge.LTC_FLOAT_2):(i.rectAreaLTC1=ge.LTC_HALF_1,i.rectAreaLTC2=ge.LTC_HALF_2)),i.ambient[0]=u,i.ambient[1]=h,i.ambient[2]=d;const L=i.hash;(L.directionalLength!==f||L.pointLength!==A||L.spotLength!==g||L.rectAreaLength!==m||L.hemiLength!==p||L.numDirectionalShadows!==E||L.numPointShadows!==v||L.numSpotShadows!==_||L.numSpotMaps!==x||L.numLightProbes!==I)&&(i.directional.length=f,i.spot.length=g,i.rectArea.length=m,i.point.length=A,i.hemi.length=p,i.directionalShadow.length=E,i.directionalShadowMap.length=E,i.pointShadow.length=v,i.pointShadowMap.length=v,i.spotShadow.length=_,i.spotShadowMap.length=_,i.directionalShadowMatrix.length=E,i.pointShadowMatrix.length=v,i.spotLightMatrix.length=_+x-S,i.spotLightMap.length=x,i.numSpotLightShadowsWithMaps=S,i.numLightProbes=I,L.directionalLength=f,L.pointLength=A,L.spotLength=g,L.rectAreaLength=m,L.hemiLength=p,L.numDirectionalShadows=E,L.numPointShadows=v,L.numSpotShadows=_,L.numSpotMaps=x,L.numLightProbes=I,i.version=cM++)}function l(c,u){let h=0,d=0,f=0,A=0,g=0;const m=u.matrixWorldInverse;for(let p=0,E=c.length;p<E;p++){const v=c[p];if(v.isDirectionalLight){const _=i.directional[h];_.direction.setFromMatrixPosition(v.matrixWorld),s.setFromMatrixPosition(v.target.matrixWorld),_.direction.sub(s),_.direction.transformDirection(m),h++}else if(v.isSpotLight){const _=i.spot[f];_.position.setFromMatrixPosition(v.matrixWorld),_.position.applyMatrix4(m),_.direction.setFromMatrixPosition(v.matrixWorld),s.setFromMatrixPosition(v.target.matrixWorld),_.direction.sub(s),_.direction.transformDirection(m),f++}else if(v.isRectAreaLight){const _=i.rectArea[A];_.position.setFromMatrixPosition(v.matrixWorld),_.position.applyMatrix4(m),o.identity(),r.copy(v.matrixWorld),r.premultiply(m),o.extractRotation(r),_.halfWidth.set(v.width*.5,0,0),_.halfHeight.set(0,v.height*.5,0),_.halfWidth.applyMatrix4(o),_.halfHeight.applyMatrix4(o),A++}else if(v.isPointLight){const _=i.point[d];_.position.setFromMatrixPosition(v.matrixWorld),_.position.applyMatrix4(m),d++}else if(v.isHemisphereLight){const _=i.hemi[g];_.direction.setFromMatrixPosition(v.matrixWorld),_.direction.transformDirection(m),g++}}}return{setup:a,setupView:l,state:i}}function Df(n){const e=new hM(n),t=[],i=[];function s(u){c.camera=u,t.length=0,i.length=0}function r(u){t.push(u)}function o(u){i.push(u)}function a(){e.setup(t)}function l(u){e.setupView(t,u)}const c={lightsArray:t,shadowsArray:i,camera:null,lights:e,transmissionRenderTarget:{}};return{init:s,state:c,setupLights:a,setupLightsView:l,pushLight:r,pushShadow:o}}function dM(n){let e=new WeakMap;function t(s,r=0){const o=e.get(s);let a;return o===void 0?(a=new Df(n),e.set(s,[a])):r>=o.length?(a=new Df(n),o.push(a)):a=o[r],a}function i(){e=new WeakMap}return{get:t,dispose:i}}const fM=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,pM=`uniform sampler2D shadow_pass;
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
}`;function AM(n,e,t){let i=new Rh;const s=new ce,r=new ce,o=new ft,a=new dv({depthPacking:T0}),l=new fv,c={},u=t.maxTextureSize,h={[Ci]:Yt,[Yt]:Ci,[nn]:nn},d=new Mn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new ce},radius:{value:4}},vertexShader:fM,fragmentShader:pM}),f=d.clone();f.defines.HORIZONTAL_PASS=1;const A=new mt;A.setAttribute("position",new it(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const g=new Me(A,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=uA;let p=this.type;this.render=function(S,I,L){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||S.length===0)return;const y=n.getRenderTarget(),b=n.getActiveCubeFace(),R=n.getActiveMipmapLevel(),U=n.state;U.setBlending(Qi),U.buffers.depth.getReversed()===!0?U.buffers.color.setClear(0,0,0,0):U.buffers.color.setClear(1,1,1,1),U.buffers.depth.setTest(!0),U.setScissorTest(!1);const N=p!==gi&&this.type===gi,G=p===gi&&this.type!==gi;for(let V=0,P=S.length;V<P;V++){const Y=S[V],H=Y.shadow;if(H===void 0){console.warn("THREE.WebGLShadowMap:",Y,"has no shadow.");continue}if(H.autoUpdate===!1&&H.needsUpdate===!1)continue;s.copy(H.mapSize);const te=H.getFrameExtents();if(s.multiply(te),r.copy(H.mapSize),(s.x>u||s.y>u)&&(s.x>u&&(r.x=Math.floor(u/te.x),s.x=r.x*te.x,H.mapSize.x=r.x),s.y>u&&(r.y=Math.floor(u/te.y),s.y=r.y*te.y,H.mapSize.y=r.y)),H.map===null||N===!0||G===!0){const ae=this.type!==gi?{minFilter:Gt,magFilter:Gt}:{};H.map!==null&&H.map.dispose(),H.map=new ys(s.x,s.y,ae),H.map.texture.name=Y.name+".shadowMap",H.camera.updateProjectionMatrix()}n.setRenderTarget(H.map),n.clear();const se=H.getViewportCount();for(let ae=0;ae<se;ae++){const ve=H.getViewport(ae);o.set(r.x*ve.x,r.y*ve.y,r.x*ve.z,r.y*ve.w),U.viewport(o),H.updateMatrices(Y,ae),i=H.getFrustum(),_(I,L,H.camera,Y,this.type)}H.isPointLightShadow!==!0&&this.type===gi&&E(H,L),H.needsUpdate=!1}p=this.type,m.needsUpdate=!1,n.setRenderTarget(y,b,R)};function E(S,I){const L=e.update(g);d.defines.VSM_SAMPLES!==S.blurSamples&&(d.defines.VSM_SAMPLES=S.blurSamples,f.defines.VSM_SAMPLES=S.blurSamples,d.needsUpdate=!0,f.needsUpdate=!0),S.mapPass===null&&(S.mapPass=new ys(s.x,s.y)),d.uniforms.shadow_pass.value=S.map.texture,d.uniforms.resolution.value=S.mapSize,d.uniforms.radius.value=S.radius,n.setRenderTarget(S.mapPass),n.clear(),n.renderBufferDirect(I,null,L,d,g,null),f.uniforms.shadow_pass.value=S.mapPass.texture,f.uniforms.resolution.value=S.mapSize,f.uniforms.radius.value=S.radius,n.setRenderTarget(S.map),n.clear(),n.renderBufferDirect(I,null,L,f,g,null)}function v(S,I,L,y){let b=null;const R=L.isPointLight===!0?S.customDistanceMaterial:S.customDepthMaterial;if(R!==void 0)b=R;else if(b=L.isPointLight===!0?l:a,n.localClippingEnabled&&I.clipShadows===!0&&Array.isArray(I.clippingPlanes)&&I.clippingPlanes.length!==0||I.displacementMap&&I.displacementScale!==0||I.alphaMap&&I.alphaTest>0||I.map&&I.alphaTest>0||I.alphaToCoverage===!0){const U=b.uuid,N=I.uuid;let G=c[U];G===void 0&&(G={},c[U]=G);let V=G[N];V===void 0&&(V=b.clone(),G[N]=V,I.addEventListener("dispose",x)),b=V}if(b.visible=I.visible,b.wireframe=I.wireframe,y===gi?b.side=I.shadowSide!==null?I.shadowSide:I.side:b.side=I.shadowSide!==null?I.shadowSide:h[I.side],b.alphaMap=I.alphaMap,b.alphaTest=I.alphaToCoverage===!0?.5:I.alphaTest,b.map=I.map,b.clipShadows=I.clipShadows,b.clippingPlanes=I.clippingPlanes,b.clipIntersection=I.clipIntersection,b.displacementMap=I.displacementMap,b.displacementScale=I.displacementScale,b.displacementBias=I.displacementBias,b.wireframeLinewidth=I.wireframeLinewidth,b.linewidth=I.linewidth,L.isPointLight===!0&&b.isMeshDistanceMaterial===!0){const U=n.properties.get(b);U.light=L}return b}function _(S,I,L,y,b){if(S.visible===!1)return;if(S.layers.test(I.layers)&&(S.isMesh||S.isLine||S.isPoints)&&(S.castShadow||S.receiveShadow&&b===gi)&&(!S.frustumCulled||i.intersectsObject(S))){S.modelViewMatrix.multiplyMatrices(L.matrixWorldInverse,S.matrixWorld);const N=e.update(S),G=S.material;if(Array.isArray(G)){const V=N.groups;for(let P=0,Y=V.length;P<Y;P++){const H=V[P],te=G[H.materialIndex];if(te&&te.visible){const se=v(S,te,y,b);S.onBeforeShadow(n,S,I,L,N,se,H),n.renderBufferDirect(L,null,N,se,S,H),S.onAfterShadow(n,S,I,L,N,se,H)}}}else if(G.visible){const V=v(S,G,y,b);S.onBeforeShadow(n,S,I,L,N,V,null),n.renderBufferDirect(L,null,N,V,S,null),S.onAfterShadow(n,S,I,L,N,V,null)}}const U=S.children;for(let N=0,G=U.length;N<G;N++)_(U[N],I,L,y,b)}function x(S){S.target.removeEventListener("dispose",x);for(const L in c){const y=c[L],b=S.target.uuid;b in y&&(y[b].dispose(),delete y[b])}}}const mM={[wu]:Cu,[Iu]:Bu,[Tu]:Lu,[Cr]:Ru,[Cu]:wu,[Bu]:Iu,[Lu]:Tu,[Ru]:Cr};function gM(n,e){function t(){let D=!1;const de=new ft;let me=null;const we=new ft(0,0,0,0);return{setMask:function(le){me!==le&&!D&&(n.colorMask(le,le,le,le),me=le)},setLocked:function(le){D=le},setClear:function(le,ee,Re,Ye,At){At===!0&&(le*=Ye,ee*=Ye,Re*=Ye),de.set(le,ee,Re,Ye),we.equals(de)===!1&&(n.clearColor(le,ee,Re,Ye),we.copy(de))},reset:function(){D=!1,me=null,we.set(-1,0,0,0)}}}function i(){let D=!1,de=!1,me=null,we=null,le=null;return{setReversed:function(ee){if(de!==ee){const Re=e.get("EXT_clip_control");ee?Re.clipControlEXT(Re.LOWER_LEFT_EXT,Re.ZERO_TO_ONE_EXT):Re.clipControlEXT(Re.LOWER_LEFT_EXT,Re.NEGATIVE_ONE_TO_ONE_EXT),de=ee;const Ye=le;le=null,this.setClear(Ye)}},getReversed:function(){return de},setTest:function(ee){ee?ne(n.DEPTH_TEST):be(n.DEPTH_TEST)},setMask:function(ee){me!==ee&&!D&&(n.depthMask(ee),me=ee)},setFunc:function(ee){if(de&&(ee=mM[ee]),we!==ee){switch(ee){case wu:n.depthFunc(n.NEVER);break;case Cu:n.depthFunc(n.ALWAYS);break;case Iu:n.depthFunc(n.LESS);break;case Cr:n.depthFunc(n.LEQUAL);break;case Tu:n.depthFunc(n.EQUAL);break;case Ru:n.depthFunc(n.GEQUAL);break;case Bu:n.depthFunc(n.GREATER);break;case Lu:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}we=ee}},setLocked:function(ee){D=ee},setClear:function(ee){le!==ee&&(de&&(ee=1-ee),n.clearDepth(ee),le=ee)},reset:function(){D=!1,me=null,we=null,le=null,de=!1}}}function s(){let D=!1,de=null,me=null,we=null,le=null,ee=null,Re=null,Ye=null,At=null;return{setTest:function(ut){D||(ut?ne(n.STENCIL_TEST):be(n.STENCIL_TEST))},setMask:function(ut){de!==ut&&!D&&(n.stencilMask(ut),de=ut)},setFunc:function(ut,Nn,Sn){(me!==ut||we!==Nn||le!==Sn)&&(n.stencilFunc(ut,Nn,Sn),me=ut,we=Nn,le=Sn)},setOp:function(ut,Nn,Sn){(ee!==ut||Re!==Nn||Ye!==Sn)&&(n.stencilOp(ut,Nn,Sn),ee=ut,Re=Nn,Ye=Sn)},setLocked:function(ut){D=ut},setClear:function(ut){At!==ut&&(n.clearStencil(ut),At=ut)},reset:function(){D=!1,de=null,me=null,we=null,le=null,ee=null,Re=null,Ye=null,At=null}}}const r=new t,o=new i,a=new s,l=new WeakMap,c=new WeakMap;let u={},h={},d=new WeakMap,f=[],A=null,g=!1,m=null,p=null,E=null,v=null,_=null,x=null,S=null,I=new ye(0,0,0),L=0,y=!1,b=null,R=null,U=null,N=null,G=null;const V=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let P=!1,Y=0;const H=n.getParameter(n.VERSION);H.indexOf("WebGL")!==-1?(Y=parseFloat(/^WebGL (\d)/.exec(H)[1]),P=Y>=1):H.indexOf("OpenGL ES")!==-1&&(Y=parseFloat(/^OpenGL ES (\d)/.exec(H)[1]),P=Y>=2);let te=null,se={};const ae=n.getParameter(n.SCISSOR_BOX),ve=n.getParameter(n.VIEWPORT),Oe=new ft().fromArray(ae),Ke=new ft().fromArray(ve);function $e(D,de,me,we){const le=new Uint8Array(4),ee=n.createTexture();n.bindTexture(D,ee),n.texParameteri(D,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(D,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let Re=0;Re<me;Re++)D===n.TEXTURE_3D||D===n.TEXTURE_2D_ARRAY?n.texImage3D(de,0,n.RGBA,1,1,we,0,n.RGBA,n.UNSIGNED_BYTE,le):n.texImage2D(de+Re,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,le);return ee}const K={};K[n.TEXTURE_2D]=$e(n.TEXTURE_2D,n.TEXTURE_2D,1),K[n.TEXTURE_CUBE_MAP]=$e(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),K[n.TEXTURE_2D_ARRAY]=$e(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),K[n.TEXTURE_3D]=$e(n.TEXTURE_3D,n.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),ne(n.DEPTH_TEST),o.setFunc(Cr),q(!1),Z(cd),ne(n.CULL_FACE),$(Qi);function ne(D){u[D]!==!0&&(n.enable(D),u[D]=!0)}function be(D){u[D]!==!1&&(n.disable(D),u[D]=!1)}function Le(D,de){return h[D]!==de?(n.bindFramebuffer(D,de),h[D]=de,D===n.DRAW_FRAMEBUFFER&&(h[n.FRAMEBUFFER]=de),D===n.FRAMEBUFFER&&(h[n.DRAW_FRAMEBUFFER]=de),!0):!1}function Se(D,de){let me=f,we=!1;if(D){me=d.get(de),me===void 0&&(me=[],d.set(de,me));const le=D.textures;if(me.length!==le.length||me[0]!==n.COLOR_ATTACHMENT0){for(let ee=0,Re=le.length;ee<Re;ee++)me[ee]=n.COLOR_ATTACHMENT0+ee;me.length=le.length,we=!0}}else me[0]!==n.BACK&&(me[0]=n.BACK,we=!0);we&&n.drawBuffers(me)}function re(D){return A!==D?(n.useProgram(D),A=D,!0):!1}const Ie={[as]:n.FUNC_ADD,[e0]:n.FUNC_SUBTRACT,[t0]:n.FUNC_REVERSE_SUBTRACT};Ie[n0]=n.MIN,Ie[i0]=n.MAX;const B={[s0]:n.ZERO,[r0]:n.ONE,[o0]:n.SRC_COLOR,[Mu]:n.SRC_ALPHA,[d0]:n.SRC_ALPHA_SATURATE,[u0]:n.DST_COLOR,[l0]:n.DST_ALPHA,[a0]:n.ONE_MINUS_SRC_COLOR,[Su]:n.ONE_MINUS_SRC_ALPHA,[h0]:n.ONE_MINUS_DST_COLOR,[c0]:n.ONE_MINUS_DST_ALPHA,[f0]:n.CONSTANT_COLOR,[p0]:n.ONE_MINUS_CONSTANT_COLOR,[A0]:n.CONSTANT_ALPHA,[m0]:n.ONE_MINUS_CONSTANT_ALPHA};function $(D,de,me,we,le,ee,Re,Ye,At,ut){if(D===Qi){g===!0&&(be(n.BLEND),g=!1);return}if(g===!1&&(ne(n.BLEND),g=!0),D!==$g){if(D!==m||ut!==y){if((p!==as||_!==as)&&(n.blendEquation(n.FUNC_ADD),p=as,_=as),ut)switch(D){case _r:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Fo:n.blendFunc(n.ONE,n.ONE);break;case ud:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case hd:n.blendFuncSeparate(n.DST_COLOR,n.ONE_MINUS_SRC_ALPHA,n.ZERO,n.ONE);break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}else switch(D){case _r:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Fo:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE,n.ONE,n.ONE);break;case ud:console.error("THREE.WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case hd:console.error("THREE.WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:console.error("THREE.WebGLState: Invalid blending: ",D);break}E=null,v=null,x=null,S=null,I.set(0,0,0),L=0,m=D,y=ut}return}le=le||de,ee=ee||me,Re=Re||we,(de!==p||le!==_)&&(n.blendEquationSeparate(Ie[de],Ie[le]),p=de,_=le),(me!==E||we!==v||ee!==x||Re!==S)&&(n.blendFuncSeparate(B[me],B[we],B[ee],B[Re]),E=me,v=we,x=ee,S=Re),(Ye.equals(I)===!1||At!==L)&&(n.blendColor(Ye.r,Ye.g,Ye.b,At),I.copy(Ye),L=At),m=D,y=!1}function j(D,de){D.side===nn?be(n.CULL_FACE):ne(n.CULL_FACE);let me=D.side===Yt;de&&(me=!me),q(me),D.blending===_r&&D.transparent===!1?$(Qi):$(D.blending,D.blendEquation,D.blendSrc,D.blendDst,D.blendEquationAlpha,D.blendSrcAlpha,D.blendDstAlpha,D.blendColor,D.blendAlpha,D.premultipliedAlpha),o.setFunc(D.depthFunc),o.setTest(D.depthTest),o.setMask(D.depthWrite),r.setMask(D.colorWrite);const we=D.stencilWrite;a.setTest(we),we&&(a.setMask(D.stencilWriteMask),a.setFunc(D.stencilFunc,D.stencilRef,D.stencilFuncMask),a.setOp(D.stencilFail,D.stencilZFail,D.stencilZPass)),oe(D.polygonOffset,D.polygonOffsetFactor,D.polygonOffsetUnits),D.alphaToCoverage===!0?ne(n.SAMPLE_ALPHA_TO_COVERAGE):be(n.SAMPLE_ALPHA_TO_COVERAGE)}function q(D){b!==D&&(D?n.frontFace(n.CW):n.frontFace(n.CCW),b=D)}function Z(D){D!==Kg?(ne(n.CULL_FACE),D!==R&&(D===cd?n.cullFace(n.BACK):D===Zg?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):be(n.CULL_FACE),R=D}function Ae(D){D!==U&&(P&&n.lineWidth(D),U=D)}function oe(D,de,me){D?(ne(n.POLYGON_OFFSET_FILL),(N!==de||G!==me)&&(n.polygonOffset(de,me),N=de,G=me)):be(n.POLYGON_OFFSET_FILL)}function pe(D){D?ne(n.SCISSOR_TEST):be(n.SCISSOR_TEST)}function We(D){D===void 0&&(D=n.TEXTURE0+V-1),te!==D&&(n.activeTexture(D),te=D)}function Xe(D,de,me){me===void 0&&(te===null?me=n.TEXTURE0+V-1:me=te);let we=se[me];we===void 0&&(we={type:void 0,texture:void 0},se[me]=we),(we.type!==D||we.texture!==de)&&(te!==me&&(n.activeTexture(me),te=me),n.bindTexture(D,de||K[D]),we.type=D,we.texture=de)}function T(){const D=se[te];D!==void 0&&D.type!==void 0&&(n.bindTexture(D.type,null),D.type=void 0,D.texture=void 0)}function M(){try{n.compressedTexImage2D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function k(){try{n.compressedTexImage3D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function X(){try{n.texSubImage2D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function ie(){try{n.texSubImage3D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function J(){try{n.compressedTexSubImage2D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function De(){try{n.compressedTexSubImage3D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function he(){try{n.texStorage2D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Be(){try{n.texStorage3D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function Te(){try{n.texImage2D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function ue(){try{n.texImage3D(...arguments)}catch(D){console.error("THREE.WebGLState:",D)}}function xe(D){Oe.equals(D)===!1&&(n.scissor(D.x,D.y,D.z,D.w),Oe.copy(D))}function He(D){Ke.equals(D)===!1&&(n.viewport(D.x,D.y,D.z,D.w),Ke.copy(D))}function Fe(D,de){let me=c.get(de);me===void 0&&(me=new WeakMap,c.set(de,me));let we=me.get(D);we===void 0&&(we=n.getUniformBlockIndex(de,D.name),me.set(D,we))}function _e(D,de){const we=c.get(de).get(D);l.get(de)!==we&&(n.uniformBlockBinding(de,we,D.__bindingPointIndex),l.set(de,we))}function Je(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),o.setReversed(!1),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),u={},te=null,se={},h={},d=new WeakMap,f=[],A=null,g=!1,m=null,p=null,E=null,v=null,_=null,x=null,S=null,I=new ye(0,0,0),L=0,y=!1,b=null,R=null,U=null,N=null,G=null,Oe.set(0,0,n.canvas.width,n.canvas.height),Ke.set(0,0,n.canvas.width,n.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:ne,disable:be,bindFramebuffer:Le,drawBuffers:Se,useProgram:re,setBlending:$,setMaterial:j,setFlipSided:q,setCullFace:Z,setLineWidth:Ae,setPolygonOffset:oe,setScissorTest:pe,activeTexture:We,bindTexture:Xe,unbindTexture:T,compressedTexImage2D:M,compressedTexImage3D:k,texImage2D:Te,texImage3D:ue,updateUBOMapping:Fe,uniformBlockBinding:_e,texStorage2D:he,texStorage3D:Be,texSubImage2D:X,texSubImage3D:ie,compressedTexSubImage2D:J,compressedTexSubImage3D:De,scissor:xe,viewport:He,reset:Je}}function _M(n,e,t,i,s,r,o){const a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new ce,u=new WeakMap;let h;const d=new WeakMap;let f=!1;try{f=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function A(T,M){return f?new OffscreenCanvas(T,M):Xo("canvas")}function g(T,M,k){let X=1;const ie=Xe(T);if((ie.width>k||ie.height>k)&&(X=k/Math.max(ie.width,ie.height)),X<1)if(typeof HTMLImageElement<"u"&&T instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&T instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&T instanceof ImageBitmap||typeof VideoFrame<"u"&&T instanceof VideoFrame){const J=Math.floor(X*ie.width),De=Math.floor(X*ie.height);h===void 0&&(h=A(J,De));const he=M?A(J,De):h;return he.width=J,he.height=De,he.getContext("2d").drawImage(T,0,0,J,De),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+ie.width+"x"+ie.height+") to ("+J+"x"+De+")."),he}else return"data"in T&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+ie.width+"x"+ie.height+")."),T;return T}function m(T){return T.generateMipmaps}function p(T){n.generateMipmap(T)}function E(T){return T.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:T.isWebGL3DRenderTarget?n.TEXTURE_3D:T.isWebGLArrayRenderTarget||T.isCompressedArrayTexture?n.TEXTURE_2D_ARRAY:n.TEXTURE_2D}function v(T,M,k,X,ie=!1){if(T!==null){if(n[T]!==void 0)return n[T];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+T+"'")}let J=M;if(M===n.RED&&(k===n.FLOAT&&(J=n.R32F),k===n.HALF_FLOAT&&(J=n.R16F),k===n.UNSIGNED_BYTE&&(J=n.R8)),M===n.RED_INTEGER&&(k===n.UNSIGNED_BYTE&&(J=n.R8UI),k===n.UNSIGNED_SHORT&&(J=n.R16UI),k===n.UNSIGNED_INT&&(J=n.R32UI),k===n.BYTE&&(J=n.R8I),k===n.SHORT&&(J=n.R16I),k===n.INT&&(J=n.R32I)),M===n.RG&&(k===n.FLOAT&&(J=n.RG32F),k===n.HALF_FLOAT&&(J=n.RG16F),k===n.UNSIGNED_BYTE&&(J=n.RG8)),M===n.RG_INTEGER&&(k===n.UNSIGNED_BYTE&&(J=n.RG8UI),k===n.UNSIGNED_SHORT&&(J=n.RG16UI),k===n.UNSIGNED_INT&&(J=n.RG32UI),k===n.BYTE&&(J=n.RG8I),k===n.SHORT&&(J=n.RG16I),k===n.INT&&(J=n.RG32I)),M===n.RGB_INTEGER&&(k===n.UNSIGNED_BYTE&&(J=n.RGB8UI),k===n.UNSIGNED_SHORT&&(J=n.RGB16UI),k===n.UNSIGNED_INT&&(J=n.RGB32UI),k===n.BYTE&&(J=n.RGB8I),k===n.SHORT&&(J=n.RGB16I),k===n.INT&&(J=n.RGB32I)),M===n.RGBA_INTEGER&&(k===n.UNSIGNED_BYTE&&(J=n.RGBA8UI),k===n.UNSIGNED_SHORT&&(J=n.RGBA16UI),k===n.UNSIGNED_INT&&(J=n.RGBA32UI),k===n.BYTE&&(J=n.RGBA8I),k===n.SHORT&&(J=n.RGBA16I),k===n.INT&&(J=n.RGBA32I)),M===n.RGB&&(k===n.UNSIGNED_INT_5_9_9_9_REV&&(J=n.RGB9_E5),k===n.UNSIGNED_INT_10F_11F_11F_REV&&(J=n.R11F_G11F_B10F)),M===n.RGBA){const De=ie?Ml:lt.getTransfer(X);k===n.FLOAT&&(J=n.RGBA32F),k===n.HALF_FLOAT&&(J=n.RGBA16F),k===n.UNSIGNED_BYTE&&(J=De===Et?n.SRGB8_ALPHA8:n.RGBA8),k===n.UNSIGNED_SHORT_4_4_4_4&&(J=n.RGBA4),k===n.UNSIGNED_SHORT_5_5_5_1&&(J=n.RGB5_A1)}return(J===n.R16F||J===n.R32F||J===n.RG16F||J===n.RG32F||J===n.RGBA16F||J===n.RGBA32F)&&e.get("EXT_color_buffer_float"),J}function _(T,M){let k;return T?M===null||M===bs||M===Oo?k=n.DEPTH24_STENCIL8:M===sn?k=n.DEPTH32F_STENCIL8:M===No&&(k=n.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):M===null||M===bs||M===Oo?k=n.DEPTH_COMPONENT24:M===sn?k=n.DEPTH_COMPONENT32F:M===No&&(k=n.DEPTH_COMPONENT16),k}function x(T,M){return m(T)===!0||T.isFramebufferTexture&&T.minFilter!==Gt&&T.minFilter!==Jt?Math.log2(Math.max(M.width,M.height))+1:T.mipmaps!==void 0&&T.mipmaps.length>0?T.mipmaps.length:T.isCompressedTexture&&Array.isArray(T.image)?M.mipmaps.length:1}function S(T){const M=T.target;M.removeEventListener("dispose",S),L(M),M.isVideoTexture&&u.delete(M)}function I(T){const M=T.target;M.removeEventListener("dispose",I),b(M)}function L(T){const M=i.get(T);if(M.__webglInit===void 0)return;const k=T.source,X=d.get(k);if(X){const ie=X[M.__cacheKey];ie.usedTimes--,ie.usedTimes===0&&y(T),Object.keys(X).length===0&&d.delete(k)}i.remove(T)}function y(T){const M=i.get(T);n.deleteTexture(M.__webglTexture);const k=T.source,X=d.get(k);delete X[M.__cacheKey],o.memory.textures--}function b(T){const M=i.get(T);if(T.depthTexture&&(T.depthTexture.dispose(),i.remove(T.depthTexture)),T.isWebGLCubeRenderTarget)for(let X=0;X<6;X++){if(Array.isArray(M.__webglFramebuffer[X]))for(let ie=0;ie<M.__webglFramebuffer[X].length;ie++)n.deleteFramebuffer(M.__webglFramebuffer[X][ie]);else n.deleteFramebuffer(M.__webglFramebuffer[X]);M.__webglDepthbuffer&&n.deleteRenderbuffer(M.__webglDepthbuffer[X])}else{if(Array.isArray(M.__webglFramebuffer))for(let X=0;X<M.__webglFramebuffer.length;X++)n.deleteFramebuffer(M.__webglFramebuffer[X]);else n.deleteFramebuffer(M.__webglFramebuffer);if(M.__webglDepthbuffer&&n.deleteRenderbuffer(M.__webglDepthbuffer),M.__webglMultisampledFramebuffer&&n.deleteFramebuffer(M.__webglMultisampledFramebuffer),M.__webglColorRenderbuffer)for(let X=0;X<M.__webglColorRenderbuffer.length;X++)M.__webglColorRenderbuffer[X]&&n.deleteRenderbuffer(M.__webglColorRenderbuffer[X]);M.__webglDepthRenderbuffer&&n.deleteRenderbuffer(M.__webglDepthRenderbuffer)}const k=T.textures;for(let X=0,ie=k.length;X<ie;X++){const J=i.get(k[X]);J.__webglTexture&&(n.deleteTexture(J.__webglTexture),o.memory.textures--),i.remove(k[X])}i.remove(T)}let R=0;function U(){R=0}function N(){const T=R;return T>=s.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+T+" texture units while this GPU supports only "+s.maxTextures),R+=1,T}function G(T){const M=[];return M.push(T.wrapS),M.push(T.wrapT),M.push(T.wrapR||0),M.push(T.magFilter),M.push(T.minFilter),M.push(T.anisotropy),M.push(T.internalFormat),M.push(T.format),M.push(T.type),M.push(T.generateMipmaps),M.push(T.premultiplyAlpha),M.push(T.flipY),M.push(T.unpackAlignment),M.push(T.colorSpace),M.join()}function V(T,M){const k=i.get(T);if(T.isVideoTexture&&pe(T),T.isRenderTargetTexture===!1&&T.isExternalTexture!==!0&&T.version>0&&k.__version!==T.version){const X=T.image;if(X===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(X.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{K(k,T,M);return}}else T.isExternalTexture&&(k.__webglTexture=T.sourceTexture?T.sourceTexture:null);t.bindTexture(n.TEXTURE_2D,k.__webglTexture,n.TEXTURE0+M)}function P(T,M){const k=i.get(T);if(T.isRenderTargetTexture===!1&&T.version>0&&k.__version!==T.version){K(k,T,M);return}t.bindTexture(n.TEXTURE_2D_ARRAY,k.__webglTexture,n.TEXTURE0+M)}function Y(T,M){const k=i.get(T);if(T.isRenderTargetTexture===!1&&T.version>0&&k.__version!==T.version){K(k,T,M);return}t.bindTexture(n.TEXTURE_3D,k.__webglTexture,n.TEXTURE0+M)}function H(T,M){const k=i.get(T);if(T.version>0&&k.__version!==T.version){ne(k,T,M);return}t.bindTexture(n.TEXTURE_CUBE_MAP,k.__webglTexture,n.TEXTURE0+M)}const te={[Es]:n.REPEAT,[bi]:n.CLAMP_TO_EDGE,[ml]:n.MIRRORED_REPEAT},se={[Gt]:n.NEAREST,[xh]:n.NEAREST_MIPMAP_NEAREST,[Eo]:n.NEAREST_MIPMAP_LINEAR,[Jt]:n.LINEAR,[rl]:n.LINEAR_MIPMAP_NEAREST,[Gn]:n.LINEAR_MIPMAP_LINEAR},ae={[B0]:n.NEVER,[N0]:n.ALWAYS,[L0]:n.LESS,[_A]:n.LEQUAL,[D0]:n.EQUAL,[F0]:n.GEQUAL,[P0]:n.GREATER,[U0]:n.NOTEQUAL};function ve(T,M){if(M.type===sn&&e.has("OES_texture_float_linear")===!1&&(M.magFilter===Jt||M.magFilter===rl||M.magFilter===Eo||M.magFilter===Gn||M.minFilter===Jt||M.minFilter===rl||M.minFilter===Eo||M.minFilter===Gn)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(T,n.TEXTURE_WRAP_S,te[M.wrapS]),n.texParameteri(T,n.TEXTURE_WRAP_T,te[M.wrapT]),(T===n.TEXTURE_3D||T===n.TEXTURE_2D_ARRAY)&&n.texParameteri(T,n.TEXTURE_WRAP_R,te[M.wrapR]),n.texParameteri(T,n.TEXTURE_MAG_FILTER,se[M.magFilter]),n.texParameteri(T,n.TEXTURE_MIN_FILTER,se[M.minFilter]),M.compareFunction&&(n.texParameteri(T,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(T,n.TEXTURE_COMPARE_FUNC,ae[M.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(M.magFilter===Gt||M.minFilter!==Eo&&M.minFilter!==Gn||M.type===sn&&e.has("OES_texture_float_linear")===!1)return;if(M.anisotropy>1||i.get(M).__currentAnisotropy){const k=e.get("EXT_texture_filter_anisotropic");n.texParameterf(T,k.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(M.anisotropy,s.getMaxAnisotropy())),i.get(M).__currentAnisotropy=M.anisotropy}}}function Oe(T,M){let k=!1;T.__webglInit===void 0&&(T.__webglInit=!0,M.addEventListener("dispose",S));const X=M.source;let ie=d.get(X);ie===void 0&&(ie={},d.set(X,ie));const J=G(M);if(J!==T.__cacheKey){ie[J]===void 0&&(ie[J]={texture:n.createTexture(),usedTimes:0},o.memory.textures++,k=!0),ie[J].usedTimes++;const De=ie[T.__cacheKey];De!==void 0&&(ie[T.__cacheKey].usedTimes--,De.usedTimes===0&&y(M)),T.__cacheKey=J,T.__webglTexture=ie[J].texture}return k}function Ke(T,M,k){return Math.floor(Math.floor(T/k)/M)}function $e(T,M,k,X){const J=T.updateRanges;if(J.length===0)t.texSubImage2D(n.TEXTURE_2D,0,0,0,M.width,M.height,k,X,M.data);else{J.sort((ue,xe)=>ue.start-xe.start);let De=0;for(let ue=1;ue<J.length;ue++){const xe=J[De],He=J[ue],Fe=xe.start+xe.count,_e=Ke(He.start,M.width,4),Je=Ke(xe.start,M.width,4);He.start<=Fe+1&&_e===Je&&Ke(He.start+He.count-1,M.width,4)===_e?xe.count=Math.max(xe.count,He.start+He.count-xe.start):(++De,J[De]=He)}J.length=De+1;const he=n.getParameter(n.UNPACK_ROW_LENGTH),Be=n.getParameter(n.UNPACK_SKIP_PIXELS),Te=n.getParameter(n.UNPACK_SKIP_ROWS);n.pixelStorei(n.UNPACK_ROW_LENGTH,M.width);for(let ue=0,xe=J.length;ue<xe;ue++){const He=J[ue],Fe=Math.floor(He.start/4),_e=Math.ceil(He.count/4),Je=Fe%M.width,D=Math.floor(Fe/M.width),de=_e,me=1;n.pixelStorei(n.UNPACK_SKIP_PIXELS,Je),n.pixelStorei(n.UNPACK_SKIP_ROWS,D),t.texSubImage2D(n.TEXTURE_2D,0,Je,D,de,me,k,X,M.data)}T.clearUpdateRanges(),n.pixelStorei(n.UNPACK_ROW_LENGTH,he),n.pixelStorei(n.UNPACK_SKIP_PIXELS,Be),n.pixelStorei(n.UNPACK_SKIP_ROWS,Te)}}function K(T,M,k){let X=n.TEXTURE_2D;(M.isDataArrayTexture||M.isCompressedArrayTexture)&&(X=n.TEXTURE_2D_ARRAY),M.isData3DTexture&&(X=n.TEXTURE_3D);const ie=Oe(T,M),J=M.source;t.bindTexture(X,T.__webglTexture,n.TEXTURE0+k);const De=i.get(J);if(J.version!==De.__version||ie===!0){t.activeTexture(n.TEXTURE0+k);const he=lt.getPrimaries(lt.workingColorSpace),Be=M.colorSpace===ti?null:lt.getPrimaries(M.colorSpace),Te=M.colorSpace===ti||he===Be?n.NONE:n.BROWSER_DEFAULT_WEBGL;n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,M.flipY),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),n.pixelStorei(n.UNPACK_ALIGNMENT,M.unpackAlignment),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,Te);let ue=g(M.image,!1,s.maxTextureSize);ue=We(M,ue);const xe=r.convert(M.format,M.colorSpace),He=r.convert(M.type);let Fe=v(M.internalFormat,xe,He,M.colorSpace,M.isVideoTexture);ve(X,M);let _e;const Je=M.mipmaps,D=M.isVideoTexture!==!0,de=De.__version===void 0||ie===!0,me=J.dataReady,we=x(M,ue);if(M.isDepthTexture)Fe=_(M.format===Ho,M.type),de&&(D?t.texStorage2D(n.TEXTURE_2D,1,Fe,ue.width,ue.height):t.texImage2D(n.TEXTURE_2D,0,Fe,ue.width,ue.height,0,xe,He,null));else if(M.isDataTexture)if(Je.length>0){D&&de&&t.texStorage2D(n.TEXTURE_2D,we,Fe,Je[0].width,Je[0].height);for(let le=0,ee=Je.length;le<ee;le++)_e=Je[le],D?me&&t.texSubImage2D(n.TEXTURE_2D,le,0,0,_e.width,_e.height,xe,He,_e.data):t.texImage2D(n.TEXTURE_2D,le,Fe,_e.width,_e.height,0,xe,He,_e.data);M.generateMipmaps=!1}else D?(de&&t.texStorage2D(n.TEXTURE_2D,we,Fe,ue.width,ue.height),me&&$e(M,ue,xe,He)):t.texImage2D(n.TEXTURE_2D,0,Fe,ue.width,ue.height,0,xe,He,ue.data);else if(M.isCompressedTexture)if(M.isCompressedArrayTexture){D&&de&&t.texStorage3D(n.TEXTURE_2D_ARRAY,we,Fe,Je[0].width,Je[0].height,ue.depth);for(let le=0,ee=Je.length;le<ee;le++)if(_e=Je[le],M.format!==Ht)if(xe!==null)if(D){if(me)if(M.layerUpdates.size>0){const Re=cf(_e.width,_e.height,M.format,M.type);for(const Ye of M.layerUpdates){const At=_e.data.subarray(Ye*Re/_e.data.BYTES_PER_ELEMENT,(Ye+1)*Re/_e.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,le,0,0,Ye,_e.width,_e.height,1,xe,At)}M.clearLayerUpdates()}else t.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,le,0,0,0,_e.width,_e.height,ue.depth,xe,_e.data)}else t.compressedTexImage3D(n.TEXTURE_2D_ARRAY,le,Fe,_e.width,_e.height,ue.depth,0,_e.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else D?me&&t.texSubImage3D(n.TEXTURE_2D_ARRAY,le,0,0,0,_e.width,_e.height,ue.depth,xe,He,_e.data):t.texImage3D(n.TEXTURE_2D_ARRAY,le,Fe,_e.width,_e.height,ue.depth,0,xe,He,_e.data)}else{D&&de&&t.texStorage2D(n.TEXTURE_2D,we,Fe,Je[0].width,Je[0].height);for(let le=0,ee=Je.length;le<ee;le++)_e=Je[le],M.format!==Ht?xe!==null?D?me&&t.compressedTexSubImage2D(n.TEXTURE_2D,le,0,0,_e.width,_e.height,xe,_e.data):t.compressedTexImage2D(n.TEXTURE_2D,le,Fe,_e.width,_e.height,0,_e.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):D?me&&t.texSubImage2D(n.TEXTURE_2D,le,0,0,_e.width,_e.height,xe,He,_e.data):t.texImage2D(n.TEXTURE_2D,le,Fe,_e.width,_e.height,0,xe,He,_e.data)}else if(M.isDataArrayTexture)if(D){if(de&&t.texStorage3D(n.TEXTURE_2D_ARRAY,we,Fe,ue.width,ue.height,ue.depth),me)if(M.layerUpdates.size>0){const le=cf(ue.width,ue.height,M.format,M.type);for(const ee of M.layerUpdates){const Re=ue.data.subarray(ee*le/ue.data.BYTES_PER_ELEMENT,(ee+1)*le/ue.data.BYTES_PER_ELEMENT);t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,ee,ue.width,ue.height,1,xe,He,Re)}M.clearLayerUpdates()}else t.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,ue.width,ue.height,ue.depth,xe,He,ue.data)}else t.texImage3D(n.TEXTURE_2D_ARRAY,0,Fe,ue.width,ue.height,ue.depth,0,xe,He,ue.data);else if(M.isData3DTexture)D?(de&&t.texStorage3D(n.TEXTURE_3D,we,Fe,ue.width,ue.height,ue.depth),me&&t.texSubImage3D(n.TEXTURE_3D,0,0,0,0,ue.width,ue.height,ue.depth,xe,He,ue.data)):t.texImage3D(n.TEXTURE_3D,0,Fe,ue.width,ue.height,ue.depth,0,xe,He,ue.data);else if(M.isFramebufferTexture){if(de)if(D)t.texStorage2D(n.TEXTURE_2D,we,Fe,ue.width,ue.height);else{let le=ue.width,ee=ue.height;for(let Re=0;Re<we;Re++)t.texImage2D(n.TEXTURE_2D,Re,Fe,le,ee,0,xe,He,null),le>>=1,ee>>=1}}else if(Je.length>0){if(D&&de){const le=Xe(Je[0]);t.texStorage2D(n.TEXTURE_2D,we,Fe,le.width,le.height)}for(let le=0,ee=Je.length;le<ee;le++)_e=Je[le],D?me&&t.texSubImage2D(n.TEXTURE_2D,le,0,0,xe,He,_e):t.texImage2D(n.TEXTURE_2D,le,Fe,xe,He,_e);M.generateMipmaps=!1}else if(D){if(de){const le=Xe(ue);t.texStorage2D(n.TEXTURE_2D,we,Fe,le.width,le.height)}me&&t.texSubImage2D(n.TEXTURE_2D,0,0,0,xe,He,ue)}else t.texImage2D(n.TEXTURE_2D,0,Fe,xe,He,ue);m(M)&&p(X),De.__version=J.version,M.onUpdate&&M.onUpdate(M)}T.__version=M.version}function ne(T,M,k){if(M.image.length!==6)return;const X=Oe(T,M),ie=M.source;t.bindTexture(n.TEXTURE_CUBE_MAP,T.__webglTexture,n.TEXTURE0+k);const J=i.get(ie);if(ie.version!==J.__version||X===!0){t.activeTexture(n.TEXTURE0+k);const De=lt.getPrimaries(lt.workingColorSpace),he=M.colorSpace===ti?null:lt.getPrimaries(M.colorSpace),Be=M.colorSpace===ti||De===he?n.NONE:n.BROWSER_DEFAULT_WEBGL;n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,M.flipY),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),n.pixelStorei(n.UNPACK_ALIGNMENT,M.unpackAlignment),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,Be);const Te=M.isCompressedTexture||M.image[0].isCompressedTexture,ue=M.image[0]&&M.image[0].isDataTexture,xe=[];for(let ee=0;ee<6;ee++)!Te&&!ue?xe[ee]=g(M.image[ee],!0,s.maxCubemapSize):xe[ee]=ue?M.image[ee].image:M.image[ee],xe[ee]=We(M,xe[ee]);const He=xe[0],Fe=r.convert(M.format,M.colorSpace),_e=r.convert(M.type),Je=v(M.internalFormat,Fe,_e,M.colorSpace),D=M.isVideoTexture!==!0,de=J.__version===void 0||X===!0,me=ie.dataReady;let we=x(M,He);ve(n.TEXTURE_CUBE_MAP,M);let le;if(Te){D&&de&&t.texStorage2D(n.TEXTURE_CUBE_MAP,we,Je,He.width,He.height);for(let ee=0;ee<6;ee++){le=xe[ee].mipmaps;for(let Re=0;Re<le.length;Re++){const Ye=le[Re];M.format!==Ht?Fe!==null?D?me&&t.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,Re,0,0,Ye.width,Ye.height,Fe,Ye.data):t.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,Re,Je,Ye.width,Ye.height,0,Ye.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):D?me&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,Re,0,0,Ye.width,Ye.height,Fe,_e,Ye.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,Re,Je,Ye.width,Ye.height,0,Fe,_e,Ye.data)}}}else{if(le=M.mipmaps,D&&de){le.length>0&&we++;const ee=Xe(xe[0]);t.texStorage2D(n.TEXTURE_CUBE_MAP,we,Je,ee.width,ee.height)}for(let ee=0;ee<6;ee++)if(ue){D?me&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,0,0,0,xe[ee].width,xe[ee].height,Fe,_e,xe[ee].data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,0,Je,xe[ee].width,xe[ee].height,0,Fe,_e,xe[ee].data);for(let Re=0;Re<le.length;Re++){const At=le[Re].image[ee].image;D?me&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,Re+1,0,0,At.width,At.height,Fe,_e,At.data):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,Re+1,Je,At.width,At.height,0,Fe,_e,At.data)}}else{D?me&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,0,0,0,Fe,_e,xe[ee]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,0,Je,Fe,_e,xe[ee]);for(let Re=0;Re<le.length;Re++){const Ye=le[Re];D?me&&t.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,Re+1,0,0,Fe,_e,Ye.image[ee]):t.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+ee,Re+1,Je,Fe,_e,Ye.image[ee])}}}m(M)&&p(n.TEXTURE_CUBE_MAP),J.__version=ie.version,M.onUpdate&&M.onUpdate(M)}T.__version=M.version}function be(T,M,k,X,ie,J){const De=r.convert(k.format,k.colorSpace),he=r.convert(k.type),Be=v(k.internalFormat,De,he,k.colorSpace),Te=i.get(M),ue=i.get(k);if(ue.__renderTarget=M,!Te.__hasExternalTextures){const xe=Math.max(1,M.width>>J),He=Math.max(1,M.height>>J);ie===n.TEXTURE_3D||ie===n.TEXTURE_2D_ARRAY?t.texImage3D(ie,J,Be,xe,He,M.depth,0,De,he,null):t.texImage2D(ie,J,Be,xe,He,0,De,he,null)}t.bindFramebuffer(n.FRAMEBUFFER,T),oe(M)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,X,ie,ue.__webglTexture,0,Ae(M)):(ie===n.TEXTURE_2D||ie>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&ie<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,X,ie,ue.__webglTexture,J),t.bindFramebuffer(n.FRAMEBUFFER,null)}function Le(T,M,k){if(n.bindRenderbuffer(n.RENDERBUFFER,T),M.depthBuffer){const X=M.depthTexture,ie=X&&X.isDepthTexture?X.type:null,J=_(M.stencilBuffer,ie),De=M.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,he=Ae(M);oe(M)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,he,J,M.width,M.height):k?n.renderbufferStorageMultisample(n.RENDERBUFFER,he,J,M.width,M.height):n.renderbufferStorage(n.RENDERBUFFER,J,M.width,M.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,De,n.RENDERBUFFER,T)}else{const X=M.textures;for(let ie=0;ie<X.length;ie++){const J=X[ie],De=r.convert(J.format,J.colorSpace),he=r.convert(J.type),Be=v(J.internalFormat,De,he,J.colorSpace),Te=Ae(M);k&&oe(M)===!1?n.renderbufferStorageMultisample(n.RENDERBUFFER,Te,Be,M.width,M.height):oe(M)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,Te,Be,M.width,M.height):n.renderbufferStorage(n.RENDERBUFFER,Be,M.width,M.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function Se(T,M){if(M&&M.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(n.FRAMEBUFFER,T),!(M.depthTexture&&M.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const X=i.get(M.depthTexture);X.__renderTarget=M,(!X.__webglTexture||M.depthTexture.image.width!==M.width||M.depthTexture.image.height!==M.height)&&(M.depthTexture.image.width=M.width,M.depthTexture.image.height=M.height,M.depthTexture.needsUpdate=!0),V(M.depthTexture,0);const ie=X.__webglTexture,J=Ae(M);if(M.depthTexture.format===Qo)oe(M)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.TEXTURE_2D,ie,0,J):n.framebufferTexture2D(n.FRAMEBUFFER,n.DEPTH_ATTACHMENT,n.TEXTURE_2D,ie,0);else if(M.depthTexture.format===Ho)oe(M)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.TEXTURE_2D,ie,0,J):n.framebufferTexture2D(n.FRAMEBUFFER,n.DEPTH_STENCIL_ATTACHMENT,n.TEXTURE_2D,ie,0);else throw new Error("Unknown depthTexture format")}function re(T){const M=i.get(T),k=T.isWebGLCubeRenderTarget===!0;if(M.__boundDepthTexture!==T.depthTexture){const X=T.depthTexture;if(M.__depthDisposeCallback&&M.__depthDisposeCallback(),X){const ie=()=>{delete M.__boundDepthTexture,delete M.__depthDisposeCallback,X.removeEventListener("dispose",ie)};X.addEventListener("dispose",ie),M.__depthDisposeCallback=ie}M.__boundDepthTexture=X}if(T.depthTexture&&!M.__autoAllocateDepthBuffer){if(k)throw new Error("target.depthTexture not supported in Cube render targets");const X=T.texture.mipmaps;X&&X.length>0?Se(M.__webglFramebuffer[0],T):Se(M.__webglFramebuffer,T)}else if(k){M.__webglDepthbuffer=[];for(let X=0;X<6;X++)if(t.bindFramebuffer(n.FRAMEBUFFER,M.__webglFramebuffer[X]),M.__webglDepthbuffer[X]===void 0)M.__webglDepthbuffer[X]=n.createRenderbuffer(),Le(M.__webglDepthbuffer[X],T,!1);else{const ie=T.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,J=M.__webglDepthbuffer[X];n.bindRenderbuffer(n.RENDERBUFFER,J),n.framebufferRenderbuffer(n.FRAMEBUFFER,ie,n.RENDERBUFFER,J)}}else{const X=T.texture.mipmaps;if(X&&X.length>0?t.bindFramebuffer(n.FRAMEBUFFER,M.__webglFramebuffer[0]):t.bindFramebuffer(n.FRAMEBUFFER,M.__webglFramebuffer),M.__webglDepthbuffer===void 0)M.__webglDepthbuffer=n.createRenderbuffer(),Le(M.__webglDepthbuffer,T,!1);else{const ie=T.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,J=M.__webglDepthbuffer;n.bindRenderbuffer(n.RENDERBUFFER,J),n.framebufferRenderbuffer(n.FRAMEBUFFER,ie,n.RENDERBUFFER,J)}}t.bindFramebuffer(n.FRAMEBUFFER,null)}function Ie(T,M,k){const X=i.get(T);M!==void 0&&be(X.__webglFramebuffer,T,T.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),k!==void 0&&re(T)}function B(T){const M=T.texture,k=i.get(T),X=i.get(M);T.addEventListener("dispose",I);const ie=T.textures,J=T.isWebGLCubeRenderTarget===!0,De=ie.length>1;if(De||(X.__webglTexture===void 0&&(X.__webglTexture=n.createTexture()),X.__version=M.version,o.memory.textures++),J){k.__webglFramebuffer=[];for(let he=0;he<6;he++)if(M.mipmaps&&M.mipmaps.length>0){k.__webglFramebuffer[he]=[];for(let Be=0;Be<M.mipmaps.length;Be++)k.__webglFramebuffer[he][Be]=n.createFramebuffer()}else k.__webglFramebuffer[he]=n.createFramebuffer()}else{if(M.mipmaps&&M.mipmaps.length>0){k.__webglFramebuffer=[];for(let he=0;he<M.mipmaps.length;he++)k.__webglFramebuffer[he]=n.createFramebuffer()}else k.__webglFramebuffer=n.createFramebuffer();if(De)for(let he=0,Be=ie.length;he<Be;he++){const Te=i.get(ie[he]);Te.__webglTexture===void 0&&(Te.__webglTexture=n.createTexture(),o.memory.textures++)}if(T.samples>0&&oe(T)===!1){k.__webglMultisampledFramebuffer=n.createFramebuffer(),k.__webglColorRenderbuffer=[],t.bindFramebuffer(n.FRAMEBUFFER,k.__webglMultisampledFramebuffer);for(let he=0;he<ie.length;he++){const Be=ie[he];k.__webglColorRenderbuffer[he]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,k.__webglColorRenderbuffer[he]);const Te=r.convert(Be.format,Be.colorSpace),ue=r.convert(Be.type),xe=v(Be.internalFormat,Te,ue,Be.colorSpace,T.isXRRenderTarget===!0),He=Ae(T);n.renderbufferStorageMultisample(n.RENDERBUFFER,He,xe,T.width,T.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+he,n.RENDERBUFFER,k.__webglColorRenderbuffer[he])}n.bindRenderbuffer(n.RENDERBUFFER,null),T.depthBuffer&&(k.__webglDepthRenderbuffer=n.createRenderbuffer(),Le(k.__webglDepthRenderbuffer,T,!0)),t.bindFramebuffer(n.FRAMEBUFFER,null)}}if(J){t.bindTexture(n.TEXTURE_CUBE_MAP,X.__webglTexture),ve(n.TEXTURE_CUBE_MAP,M);for(let he=0;he<6;he++)if(M.mipmaps&&M.mipmaps.length>0)for(let Be=0;Be<M.mipmaps.length;Be++)be(k.__webglFramebuffer[he][Be],T,M,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+he,Be);else be(k.__webglFramebuffer[he],T,M,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+he,0);m(M)&&p(n.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(De){for(let he=0,Be=ie.length;he<Be;he++){const Te=ie[he],ue=i.get(Te);let xe=n.TEXTURE_2D;(T.isWebGL3DRenderTarget||T.isWebGLArrayRenderTarget)&&(xe=T.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(xe,ue.__webglTexture),ve(xe,Te),be(k.__webglFramebuffer,T,Te,n.COLOR_ATTACHMENT0+he,xe,0),m(Te)&&p(xe)}t.unbindTexture()}else{let he=n.TEXTURE_2D;if((T.isWebGL3DRenderTarget||T.isWebGLArrayRenderTarget)&&(he=T.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),t.bindTexture(he,X.__webglTexture),ve(he,M),M.mipmaps&&M.mipmaps.length>0)for(let Be=0;Be<M.mipmaps.length;Be++)be(k.__webglFramebuffer[Be],T,M,n.COLOR_ATTACHMENT0,he,Be);else be(k.__webglFramebuffer,T,M,n.COLOR_ATTACHMENT0,he,0);m(M)&&p(he),t.unbindTexture()}T.depthBuffer&&re(T)}function $(T){const M=T.textures;for(let k=0,X=M.length;k<X;k++){const ie=M[k];if(m(ie)){const J=E(T),De=i.get(ie).__webglTexture;t.bindTexture(J,De),p(J),t.unbindTexture()}}}const j=[],q=[];function Z(T){if(T.samples>0){if(oe(T)===!1){const M=T.textures,k=T.width,X=T.height;let ie=n.COLOR_BUFFER_BIT;const J=T.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,De=i.get(T),he=M.length>1;if(he)for(let Te=0;Te<M.length;Te++)t.bindFramebuffer(n.FRAMEBUFFER,De.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+Te,n.RENDERBUFFER,null),t.bindFramebuffer(n.FRAMEBUFFER,De.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+Te,n.TEXTURE_2D,null,0);t.bindFramebuffer(n.READ_FRAMEBUFFER,De.__webglMultisampledFramebuffer);const Be=T.texture.mipmaps;Be&&Be.length>0?t.bindFramebuffer(n.DRAW_FRAMEBUFFER,De.__webglFramebuffer[0]):t.bindFramebuffer(n.DRAW_FRAMEBUFFER,De.__webglFramebuffer);for(let Te=0;Te<M.length;Te++){if(T.resolveDepthBuffer&&(T.depthBuffer&&(ie|=n.DEPTH_BUFFER_BIT),T.stencilBuffer&&T.resolveStencilBuffer&&(ie|=n.STENCIL_BUFFER_BIT)),he){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,De.__webglColorRenderbuffer[Te]);const ue=i.get(M[Te]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,ue,0)}n.blitFramebuffer(0,0,k,X,0,0,k,X,ie,n.NEAREST),l===!0&&(j.length=0,q.length=0,j.push(n.COLOR_ATTACHMENT0+Te),T.depthBuffer&&T.resolveDepthBuffer===!1&&(j.push(J),q.push(J),n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,q)),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,j))}if(t.bindFramebuffer(n.READ_FRAMEBUFFER,null),t.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),he)for(let Te=0;Te<M.length;Te++){t.bindFramebuffer(n.FRAMEBUFFER,De.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+Te,n.RENDERBUFFER,De.__webglColorRenderbuffer[Te]);const ue=i.get(M[Te]).__webglTexture;t.bindFramebuffer(n.FRAMEBUFFER,De.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+Te,n.TEXTURE_2D,ue,0)}t.bindFramebuffer(n.DRAW_FRAMEBUFFER,De.__webglMultisampledFramebuffer)}else if(T.depthBuffer&&T.resolveDepthBuffer===!1&&l){const M=T.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[M])}}}function Ae(T){return Math.min(s.maxSamples,T.samples)}function oe(T){const M=i.get(T);return T.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&M.__useRenderToTexture!==!1}function pe(T){const M=o.render.frame;u.get(T)!==M&&(u.set(T,M),T.update())}function We(T,M){const k=T.colorSpace,X=T.format,ie=T.type;return T.isCompressedTexture===!0||T.isVideoTexture===!0||k!==rn&&k!==ti&&(lt.getTransfer(k)===Et?(X!==Ht||ie!==tt)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",k)),M}function Xe(T){return typeof HTMLImageElement<"u"&&T instanceof HTMLImageElement?(c.width=T.naturalWidth||T.width,c.height=T.naturalHeight||T.height):typeof VideoFrame<"u"&&T instanceof VideoFrame?(c.width=T.displayWidth,c.height=T.displayHeight):(c.width=T.width,c.height=T.height),c}this.allocateTextureUnit=N,this.resetTextureUnits=U,this.setTexture2D=V,this.setTexture2DArray=P,this.setTexture3D=Y,this.setTextureCube=H,this.rebindTextures=Ie,this.setupRenderTarget=B,this.updateRenderTargetMipmap=$,this.updateMultisampleRenderTarget=Z,this.setupDepthRenderbuffer=re,this.setupFrameBufferTexture=be,this.useMultisampledRTT=oe}function vM(n,e){function t(i,s=ti){let r;const o=lt.getTransfer(s);if(i===tt)return n.UNSIGNED_BYTE;if(i===bh)return n.UNSIGNED_SHORT_4_4_4_4;if(i===yh)return n.UNSIGNED_SHORT_5_5_5_1;if(i===Ql)return n.UNSIGNED_INT_5_9_9_9_REV;if(i===Hl)return n.UNSIGNED_INT_10F_11F_11F_REV;if(i===pA)return n.BYTE;if(i===AA)return n.SHORT;if(i===No)return n.UNSIGNED_SHORT;if(i===Eh)return n.INT;if(i===bs)return n.UNSIGNED_INT;if(i===sn)return n.FLOAT;if(i===Ln)return n.HALF_FLOAT;if(i===mA)return n.ALPHA;if(i===ko)return n.RGB;if(i===Ht)return n.RGBA;if(i===Qo)return n.DEPTH_COMPONENT;if(i===Ho)return n.DEPTH_STENCIL;if(i===Oi)return n.RED;if(i===Mh)return n.RED_INTEGER;if(i===ds)return n.RG;if(i===Sh)return n.RG_INTEGER;if(i===wh)return n.RGBA_INTEGER;if(i===vr||i===gs||i===xr||i===Co)if(o===Et)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(i===vr)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===gs)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===xr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===Co)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(i===vr)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===gs)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===xr)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===Co)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===gl||i===Uu||i===Tr||i===Go)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(i===gl)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Uu)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===Tr)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===Go)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===_l||i===zo||i===Vo)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(i===_l||i===zo)return o===Et?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(i===Vo)return o===Et?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(i===_s||i===Fu||i===Nu||i===Ou||i===Er||i===ku||i===Qu||i===Hu||i===Gu||i===zu||i===Vu||i===Wu||i===qu||i===Xu)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(i===_s)return o===Et?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Fu)return o===Et?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===Nu)return o===Et?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Ou)return o===Et?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===Er)return o===Et?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===ku)return o===Et?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===Qu)return o===Et?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===Hu)return o===Et?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Gu)return o===Et?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===zu)return o===Et?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===Vu)return o===Et?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===Wu)return o===Et?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===qu)return o===Et?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===Xu)return o===Et?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===Rr||i===Yu||i===vl)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(i===Rr)return o===Et?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===Yu)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===vl)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===xl||i===El||i===bl||i===yl)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(i===xl)return r.COMPRESSED_RED_RGTC1_EXT;if(i===El)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===bl)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===yl)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===Oo?n.UNSIGNED_INT_24_8:n[i]!==void 0?n[i]:null}return{convert:t}}const xM=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,EM=`
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

}`;class bM{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){const i=new NA(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=i}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,i=new Mn({vertexShader:xM,fragmentShader:EM,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Me(new En(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class yM extends Qr{constructor(e,t){super();const i=this;let s=null,r=1,o=null,a="local-floor",l=1,c=null,u=null,h=null,d=null,f=null,A=null;const g=typeof XRWebGLBinding<"u",m=new bM,p={},E=t.getContextAttributes();let v=null,_=null;const x=[],S=[],I=new ce;let L=null;const y=new hn;y.viewport=new ft;const b=new hn;b.viewport=new ft;const R=[y,b],U=new Dv;let N=null,G=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(K){let ne=x[K];return ne===void 0&&(ne=new yc,x[K]=ne),ne.getTargetRaySpace()},this.getControllerGrip=function(K){let ne=x[K];return ne===void 0&&(ne=new yc,x[K]=ne),ne.getGripSpace()},this.getHand=function(K){let ne=x[K];return ne===void 0&&(ne=new yc,x[K]=ne),ne.getHandSpace()};function V(K){const ne=S.indexOf(K.inputSource);if(ne===-1)return;const be=x[ne];be!==void 0&&(be.update(K.inputSource,K.frame,c||o),be.dispatchEvent({type:K.type,data:K.inputSource}))}function P(){s.removeEventListener("select",V),s.removeEventListener("selectstart",V),s.removeEventListener("selectend",V),s.removeEventListener("squeeze",V),s.removeEventListener("squeezestart",V),s.removeEventListener("squeezeend",V),s.removeEventListener("end",P),s.removeEventListener("inputsourceschange",Y);for(let K=0;K<x.length;K++){const ne=S[K];ne!==null&&(S[K]=null,x[K].disconnect(ne))}N=null,G=null,m.reset();for(const K in p)delete p[K];e.setRenderTarget(v),f=null,d=null,h=null,s=null,_=null,$e.stop(),i.isPresenting=!1,e.setPixelRatio(L),e.setSize(I.width,I.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(K){r=K,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(K){a=K,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(K){c=K},this.getBaseLayer=function(){return d!==null?d:f},this.getBinding=function(){return h===null&&g&&(h=new XRWebGLBinding(s,t)),h},this.getFrame=function(){return A},this.getSession=function(){return s},this.setSession=async function(K){if(s=K,s!==null){if(v=e.getRenderTarget(),s.addEventListener("select",V),s.addEventListener("selectstart",V),s.addEventListener("selectend",V),s.addEventListener("squeeze",V),s.addEventListener("squeezestart",V),s.addEventListener("squeezeend",V),s.addEventListener("end",P),s.addEventListener("inputsourceschange",Y),E.xrCompatible!==!0&&await t.makeXRCompatible(),L=e.getPixelRatio(),e.getSize(I),g&&"createProjectionLayer"in XRWebGLBinding.prototype){let be=null,Le=null,Se=null;E.depth&&(Se=E.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,be=E.stencil?Ho:Qo,Le=E.stencil?Oo:bs);const re={colorFormat:t.RGBA8,depthFormat:Se,scaleFactor:r};h=this.getBinding(),d=h.createProjectionLayer(re),s.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),_=new ys(d.textureWidth,d.textureHeight,{format:Ht,type:tt,depthTexture:new FA(d.textureWidth,d.textureHeight,Le,void 0,void 0,void 0,void 0,void 0,void 0,be),stencilBuffer:E.stencil,colorSpace:e.outputColorSpace,samples:E.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1})}else{const be={antialias:E.antialias,alpha:!0,depth:E.depth,stencil:E.stencil,framebufferScaleFactor:r};f=new XRWebGLLayer(s,t,be),s.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),_=new ys(f.framebufferWidth,f.framebufferHeight,{format:Ht,type:tt,colorSpace:e.outputColorSpace,stencilBuffer:E.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1})}_.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await s.requestReferenceSpace(a),$e.setContext(s),$e.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function Y(K){for(let ne=0;ne<K.removed.length;ne++){const be=K.removed[ne],Le=S.indexOf(be);Le>=0&&(S[Le]=null,x[Le].disconnect(be))}for(let ne=0;ne<K.added.length;ne++){const be=K.added[ne];let Le=S.indexOf(be);if(Le===-1){for(let re=0;re<x.length;re++)if(re>=S.length){S.push(be),Le=re;break}else if(S[re]===null){S[re]=be,Le=re;break}if(Le===-1)break}const Se=x[Le];Se&&Se.connect(be)}}const H=new w,te=new w;function se(K,ne,be){H.setFromMatrixPosition(ne.matrixWorld),te.setFromMatrixPosition(be.matrixWorld);const Le=H.distanceTo(te),Se=ne.projectionMatrix.elements,re=be.projectionMatrix.elements,Ie=Se[14]/(Se[10]-1),B=Se[14]/(Se[10]+1),$=(Se[9]+1)/Se[5],j=(Se[9]-1)/Se[5],q=(Se[8]-1)/Se[0],Z=(re[8]+1)/re[0],Ae=Ie*q,oe=Ie*Z,pe=Le/(-q+Z),We=pe*-q;if(ne.matrixWorld.decompose(K.position,K.quaternion,K.scale),K.translateX(We),K.translateZ(pe),K.matrixWorld.compose(K.position,K.quaternion,K.scale),K.matrixWorldInverse.copy(K.matrixWorld).invert(),Se[10]===-1)K.projectionMatrix.copy(ne.projectionMatrix),K.projectionMatrixInverse.copy(ne.projectionMatrixInverse);else{const Xe=Ie+pe,T=B+pe,M=Ae-We,k=oe+(Le-We),X=$*B/T*Xe,ie=j*B/T*Xe;K.projectionMatrix.makePerspective(M,k,X,ie,Xe,T),K.projectionMatrixInverse.copy(K.projectionMatrix).invert()}}function ae(K,ne){ne===null?K.matrixWorld.copy(K.matrix):K.matrixWorld.multiplyMatrices(ne.matrixWorld,K.matrix),K.matrixWorldInverse.copy(K.matrixWorld).invert()}this.updateCamera=function(K){if(s===null)return;let ne=K.near,be=K.far;m.texture!==null&&(m.depthNear>0&&(ne=m.depthNear),m.depthFar>0&&(be=m.depthFar)),U.near=b.near=y.near=ne,U.far=b.far=y.far=be,(N!==U.near||G!==U.far)&&(s.updateRenderState({depthNear:U.near,depthFar:U.far}),N=U.near,G=U.far),U.layers.mask=K.layers.mask|6,y.layers.mask=U.layers.mask&3,b.layers.mask=U.layers.mask&5;const Le=K.parent,Se=U.cameras;ae(U,Le);for(let re=0;re<Se.length;re++)ae(Se[re],Le);Se.length===2?se(U,y,b):U.projectionMatrix.copy(y.projectionMatrix),ve(K,U,Le)};function ve(K,ne,be){be===null?K.matrix.copy(ne.matrixWorld):(K.matrix.copy(be.matrixWorld),K.matrix.invert(),K.matrix.multiply(ne.matrixWorld)),K.matrix.decompose(K.position,K.quaternion,K.scale),K.updateMatrixWorld(!0),K.projectionMatrix.copy(ne.projectionMatrix),K.projectionMatrixInverse.copy(ne.projectionMatrixInverse),K.isPerspectiveCamera&&(K.fov=Br*2*Math.atan(1/K.projectionMatrix.elements[5]),K.zoom=1)}this.getCamera=function(){return U},this.getFoveation=function(){if(!(d===null&&f===null))return l},this.setFoveation=function(K){l=K,d!==null&&(d.fixedFoveation=K),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=K)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(U)},this.getCameraTexture=function(K){return p[K]};let Oe=null;function Ke(K,ne){if(u=ne.getViewerPose(c||o),A=ne,u!==null){const be=u.views;f!==null&&(e.setRenderTargetFramebuffer(_,f.framebuffer),e.setRenderTarget(_));let Le=!1;be.length!==U.cameras.length&&(U.cameras.length=0,Le=!0);for(let B=0;B<be.length;B++){const $=be[B];let j=null;if(f!==null)j=f.getViewport($);else{const Z=h.getViewSubImage(d,$);j=Z.viewport,B===0&&(e.setRenderTargetTextures(_,Z.colorTexture,Z.depthStencilTexture),e.setRenderTarget(_))}let q=R[B];q===void 0&&(q=new hn,q.layers.enable(B),q.viewport=new ft,R[B]=q),q.matrix.fromArray($.transform.matrix),q.matrix.decompose(q.position,q.quaternion,q.scale),q.projectionMatrix.fromArray($.projectionMatrix),q.projectionMatrixInverse.copy(q.projectionMatrix).invert(),q.viewport.set(j.x,j.y,j.width,j.height),B===0&&(U.matrix.copy(q.matrix),U.matrix.decompose(U.position,U.quaternion,U.scale)),Le===!0&&U.cameras.push(q)}const Se=s.enabledFeatures;if(Se&&Se.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&g){h=i.getBinding();const B=h.getDepthInformation(be[0]);B&&B.isValid&&B.texture&&m.init(B,s.renderState)}if(Se&&Se.includes("camera-access")&&g){e.state.unbindTexture(),h=i.getBinding();for(let B=0;B<be.length;B++){const $=be[B].camera;if($){let j=p[$];j||(j=new NA,p[$]=j);const q=h.getCameraImage($);j.sourceTexture=q}}}}for(let be=0;be<x.length;be++){const Le=S[be],Se=x[be];Le!==null&&Se!==void 0&&Se.update(Le,ne,c||o)}Oe&&Oe(K,ne),ne.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:ne}),A=null}const $e=new em;$e.setAnimationLoop(Ke),this.setAnimationLoop=function(K){Oe=K},this.dispose=function(){}}}const Ji=new fn,MM=new Qe;function SM(n,e){function t(m,p){m.matrixAutoUpdate===!0&&m.updateMatrix(),p.value.copy(m.matrix)}function i(m,p){p.color.getRGB(m.fogColor.value,wA(n)),p.isFog?(m.fogNear.value=p.near,m.fogFar.value=p.far):p.isFogExp2&&(m.fogDensity.value=p.density)}function s(m,p,E,v,_){p.isMeshBasicMaterial||p.isMeshLambertMaterial?r(m,p):p.isMeshToonMaterial?(r(m,p),h(m,p)):p.isMeshPhongMaterial?(r(m,p),u(m,p)):p.isMeshStandardMaterial?(r(m,p),d(m,p),p.isMeshPhysicalMaterial&&f(m,p,_)):p.isMeshMatcapMaterial?(r(m,p),A(m,p)):p.isMeshDepthMaterial?r(m,p):p.isMeshDistanceMaterial?(r(m,p),g(m,p)):p.isMeshNormalMaterial?r(m,p):p.isLineBasicMaterial?(o(m,p),p.isLineDashedMaterial&&a(m,p)):p.isPointsMaterial?l(m,p,E,v):p.isSpriteMaterial?c(m,p):p.isShadowMaterial?(m.color.value.copy(p.color),m.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function r(m,p){m.opacity.value=p.opacity,p.color&&m.diffuse.value.copy(p.color),p.emissive&&m.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(m.map.value=p.map,t(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.bumpMap&&(m.bumpMap.value=p.bumpMap,t(p.bumpMap,m.bumpMapTransform),m.bumpScale.value=p.bumpScale,p.side===Yt&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,t(p.normalMap,m.normalMapTransform),m.normalScale.value.copy(p.normalScale),p.side===Yt&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,t(p.displacementMap,m.displacementMapTransform),m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap,t(p.emissiveMap,m.emissiveMapTransform)),p.specularMap&&(m.specularMap.value=p.specularMap,t(p.specularMap,m.specularMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest);const E=e.get(p),v=E.envMap,_=E.envMapRotation;v&&(m.envMap.value=v,Ji.copy(_),Ji.x*=-1,Ji.y*=-1,Ji.z*=-1,v.isCubeTexture&&v.isRenderTargetTexture===!1&&(Ji.y*=-1,Ji.z*=-1),m.envMapRotation.value.setFromMatrix4(MM.makeRotationFromEuler(Ji)),m.flipEnvMap.value=v.isCubeTexture&&v.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=p.reflectivity,m.ior.value=p.ior,m.refractionRatio.value=p.refractionRatio),p.lightMap&&(m.lightMap.value=p.lightMap,m.lightMapIntensity.value=p.lightMapIntensity,t(p.lightMap,m.lightMapTransform)),p.aoMap&&(m.aoMap.value=p.aoMap,m.aoMapIntensity.value=p.aoMapIntensity,t(p.aoMap,m.aoMapTransform))}function o(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,p.map&&(m.map.value=p.map,t(p.map,m.mapTransform))}function a(m,p){m.dashSize.value=p.dashSize,m.totalSize.value=p.dashSize+p.gapSize,m.scale.value=p.scale}function l(m,p,E,v){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.size.value=p.size*E,m.scale.value=v*.5,p.map&&(m.map.value=p.map,t(p.map,m.uvTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function c(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.rotation.value=p.rotation,p.map&&(m.map.value=p.map,t(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function u(m,p){m.specular.value.copy(p.specular),m.shininess.value=Math.max(p.shininess,1e-4)}function h(m,p){p.gradientMap&&(m.gradientMap.value=p.gradientMap)}function d(m,p){m.metalness.value=p.metalness,p.metalnessMap&&(m.metalnessMap.value=p.metalnessMap,t(p.metalnessMap,m.metalnessMapTransform)),m.roughness.value=p.roughness,p.roughnessMap&&(m.roughnessMap.value=p.roughnessMap,t(p.roughnessMap,m.roughnessMapTransform)),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)}function f(m,p,E){m.ior.value=p.ior,p.sheen>0&&(m.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),m.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(m.sheenColorMap.value=p.sheenColorMap,t(p.sheenColorMap,m.sheenColorMapTransform)),p.sheenRoughnessMap&&(m.sheenRoughnessMap.value=p.sheenRoughnessMap,t(p.sheenRoughnessMap,m.sheenRoughnessMapTransform))),p.clearcoat>0&&(m.clearcoat.value=p.clearcoat,m.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(m.clearcoatMap.value=p.clearcoatMap,t(p.clearcoatMap,m.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,t(p.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(m.clearcoatNormalMap.value=p.clearcoatNormalMap,t(p.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===Yt&&m.clearcoatNormalScale.value.negate())),p.dispersion>0&&(m.dispersion.value=p.dispersion),p.iridescence>0&&(m.iridescence.value=p.iridescence,m.iridescenceIOR.value=p.iridescenceIOR,m.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(m.iridescenceMap.value=p.iridescenceMap,t(p.iridescenceMap,m.iridescenceMapTransform)),p.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=p.iridescenceThicknessMap,t(p.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),p.transmission>0&&(m.transmission.value=p.transmission,m.transmissionSamplerMap.value=E.texture,m.transmissionSamplerSize.value.set(E.width,E.height),p.transmissionMap&&(m.transmissionMap.value=p.transmissionMap,t(p.transmissionMap,m.transmissionMapTransform)),m.thickness.value=p.thickness,p.thicknessMap&&(m.thicknessMap.value=p.thicknessMap,t(p.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=p.attenuationDistance,m.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(m.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(m.anisotropyMap.value=p.anisotropyMap,t(p.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=p.specularIntensity,m.specularColor.value.copy(p.specularColor),p.specularColorMap&&(m.specularColorMap.value=p.specularColorMap,t(p.specularColorMap,m.specularColorMapTransform)),p.specularIntensityMap&&(m.specularIntensityMap.value=p.specularIntensityMap,t(p.specularIntensityMap,m.specularIntensityMapTransform))}function A(m,p){p.matcap&&(m.matcap.value=p.matcap)}function g(m,p){const E=e.get(p).light;m.referencePosition.value.setFromMatrixPosition(E.matrixWorld),m.nearDistance.value=E.shadow.camera.near,m.farDistance.value=E.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:s}}function wM(n,e,t,i){let s={},r={},o=[];const a=n.getParameter(n.MAX_UNIFORM_BUFFER_BINDINGS);function l(E,v){const _=v.program;i.uniformBlockBinding(E,_)}function c(E,v){let _=s[E.id];_===void 0&&(A(E),_=u(E),s[E.id]=_,E.addEventListener("dispose",m));const x=v.program;i.updateUBOMapping(E,x);const S=e.render.frame;r[E.id]!==S&&(d(E),r[E.id]=S)}function u(E){const v=h();E.__bindingPointIndex=v;const _=n.createBuffer(),x=E.__size,S=E.usage;return n.bindBuffer(n.UNIFORM_BUFFER,_),n.bufferData(n.UNIFORM_BUFFER,x,S),n.bindBuffer(n.UNIFORM_BUFFER,null),n.bindBufferBase(n.UNIFORM_BUFFER,v,_),_}function h(){for(let E=0;E<a;E++)if(o.indexOf(E)===-1)return o.push(E),E;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(E){const v=s[E.id],_=E.uniforms,x=E.__cache;n.bindBuffer(n.UNIFORM_BUFFER,v);for(let S=0,I=_.length;S<I;S++){const L=Array.isArray(_[S])?_[S]:[_[S]];for(let y=0,b=L.length;y<b;y++){const R=L[y];if(f(R,S,y,x)===!0){const U=R.__offset,N=Array.isArray(R.value)?R.value:[R.value];let G=0;for(let V=0;V<N.length;V++){const P=N[V],Y=g(P);typeof P=="number"||typeof P=="boolean"?(R.__data[0]=P,n.bufferSubData(n.UNIFORM_BUFFER,U+G,R.__data)):P.isMatrix3?(R.__data[0]=P.elements[0],R.__data[1]=P.elements[1],R.__data[2]=P.elements[2],R.__data[3]=0,R.__data[4]=P.elements[3],R.__data[5]=P.elements[4],R.__data[6]=P.elements[5],R.__data[7]=0,R.__data[8]=P.elements[6],R.__data[9]=P.elements[7],R.__data[10]=P.elements[8],R.__data[11]=0):(P.toArray(R.__data,G),G+=Y.storage/Float32Array.BYTES_PER_ELEMENT)}n.bufferSubData(n.UNIFORM_BUFFER,U,R.__data)}}}n.bindBuffer(n.UNIFORM_BUFFER,null)}function f(E,v,_,x){const S=E.value,I=v+"_"+_;if(x[I]===void 0)return typeof S=="number"||typeof S=="boolean"?x[I]=S:x[I]=S.clone(),!0;{const L=x[I];if(typeof S=="number"||typeof S=="boolean"){if(L!==S)return x[I]=S,!0}else if(L.equals(S)===!1)return L.copy(S),!0}return!1}function A(E){const v=E.uniforms;let _=0;const x=16;for(let I=0,L=v.length;I<L;I++){const y=Array.isArray(v[I])?v[I]:[v[I]];for(let b=0,R=y.length;b<R;b++){const U=y[b],N=Array.isArray(U.value)?U.value:[U.value];for(let G=0,V=N.length;G<V;G++){const P=N[G],Y=g(P),H=_%x,te=H%Y.boundary,se=H+te;_+=te,se!==0&&x-se<Y.storage&&(_+=x-se),U.__data=new Float32Array(Y.storage/Float32Array.BYTES_PER_ELEMENT),U.__offset=_,_+=Y.storage}}}const S=_%x;return S>0&&(_+=x-S),E.__size=_,E.__cache={},this}function g(E){const v={boundary:0,storage:0};return typeof E=="number"||typeof E=="boolean"?(v.boundary=4,v.storage=4):E.isVector2?(v.boundary=8,v.storage=8):E.isVector3||E.isColor?(v.boundary=16,v.storage=12):E.isVector4?(v.boundary=16,v.storage=16):E.isMatrix3?(v.boundary=48,v.storage=48):E.isMatrix4?(v.boundary=64,v.storage=64):E.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",E),v}function m(E){const v=E.target;v.removeEventListener("dispose",m);const _=o.indexOf(v.__bindingPointIndex);o.splice(_,1),n.deleteBuffer(s[v.id]),delete s[v.id],delete r[v.id]}function p(){for(const E in s)n.deleteBuffer(s[E]);o=[],s={},r={}}return{bind:l,update:c,dispose:p}}class CM{constructor(e={}){const{canvas:t=e_(),context:i=null,depth:s=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:u="default",failIfMajorPerformanceCaveat:h=!1,reversedDepthBuffer:d=!1}=e;this.isWebGLRenderer=!0;let f;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");f=i.getContextAttributes().alpha}else f=o;const A=new Uint32Array(4),g=new Int32Array(4);let m=null,p=null;const E=[],v=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Hi,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const _=this;let x=!1;this._outputColorSpace=Bt;let S=0,I=0,L=null,y=-1,b=null;const R=new ft,U=new ft;let N=null;const G=new ye(0);let V=0,P=t.width,Y=t.height,H=1,te=null,se=null;const ae=new ft(0,0,P,Y),ve=new ft(0,0,P,Y);let Oe=!1;const Ke=new Rh;let $e=!1,K=!1;const ne=new Qe,be=new w,Le=new ft,Se={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let re=!1;function Ie(){return L===null?H:1}let B=i;function $(C,F){return t.getContext(C,F)}try{const C={alpha:!0,depth:s,stencil:r,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:u,failIfMajorPerformanceCaveat:h};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${vs}`),t.addEventListener("webglcontextlost",me,!1),t.addEventListener("webglcontextrestored",we,!1),t.addEventListener("webglcontextcreationerror",le,!1),B===null){const F="webgl2";if(B=$(F,C),B===null)throw $(F)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(C){throw console.error("THREE.WebGLRenderer: "+C.message),C}let j,q,Z,Ae,oe,pe,We,Xe,T,M,k,X,ie,J,De,he,Be,Te,ue,xe,He,Fe,_e,Je;function D(){j=new Nb(B),j.init(),Fe=new vM(B,j),q=new Rb(B,j,e,Fe),Z=new gM(B,j),q.reversedDepthBuffer&&d&&Z.buffers.depth.setReversed(!0),Ae=new Qb(B),oe=new sM,pe=new _M(B,j,Z,oe,q,Fe,Ae),We=new Lb(_),Xe=new Fb(_),T=new qv(B),_e=new Ib(B,T),M=new Ob(B,T,Ae,_e),k=new Gb(B,M,T,Ae),ue=new Hb(B,q,pe),he=new Bb(oe),X=new iM(_,We,Xe,j,q,_e,he),ie=new SM(_,oe),J=new oM,De=new dM(j),Te=new Cb(_,We,Xe,Z,k,f,l),Be=new AM(_,k,q),Je=new wM(B,Ae,q,Z),xe=new Tb(B,j,Ae),He=new kb(B,j,Ae),Ae.programs=X.programs,_.capabilities=q,_.extensions=j,_.properties=oe,_.renderLists=J,_.shadowMap=Be,_.state=Z,_.info=Ae}D();const de=new yM(_,B);this.xr=de,this.getContext=function(){return B},this.getContextAttributes=function(){return B.getContextAttributes()},this.forceContextLoss=function(){const C=j.get("WEBGL_lose_context");C&&C.loseContext()},this.forceContextRestore=function(){const C=j.get("WEBGL_lose_context");C&&C.restoreContext()},this.getPixelRatio=function(){return H},this.setPixelRatio=function(C){C!==void 0&&(H=C,this.setSize(P,Y,!1))},this.getSize=function(C){return C.set(P,Y)},this.setSize=function(C,F,z=!0){if(de.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}P=C,Y=F,t.width=Math.floor(C*H),t.height=Math.floor(F*H),z===!0&&(t.style.width=C+"px",t.style.height=F+"px"),this.setViewport(0,0,C,F)},this.getDrawingBufferSize=function(C){return C.set(P*H,Y*H).floor()},this.setDrawingBufferSize=function(C,F,z){P=C,Y=F,H=z,t.width=Math.floor(C*z),t.height=Math.floor(F*z),this.setViewport(0,0,C,F)},this.getCurrentViewport=function(C){return C.copy(R)},this.getViewport=function(C){return C.copy(ae)},this.setViewport=function(C,F,z,W){C.isVector4?ae.set(C.x,C.y,C.z,C.w):ae.set(C,F,z,W),Z.viewport(R.copy(ae).multiplyScalar(H).round())},this.getScissor=function(C){return C.copy(ve)},this.setScissor=function(C,F,z,W){C.isVector4?ve.set(C.x,C.y,C.z,C.w):ve.set(C,F,z,W),Z.scissor(U.copy(ve).multiplyScalar(H).round())},this.getScissorTest=function(){return Oe},this.setScissorTest=function(C){Z.setScissorTest(Oe=C)},this.setOpaqueSort=function(C){te=C},this.setTransparentSort=function(C){se=C},this.getClearColor=function(C){return C.copy(Te.getClearColor())},this.setClearColor=function(){Te.setClearColor(...arguments)},this.getClearAlpha=function(){return Te.getClearAlpha()},this.setClearAlpha=function(){Te.setClearAlpha(...arguments)},this.clear=function(C=!0,F=!0,z=!0){let W=0;if(C){let O=!1;if(L!==null){const fe=L.texture.format;O=fe===wh||fe===Sh||fe===Mh}if(O){const fe=L.texture.type,Ee=fe===tt||fe===bs||fe===No||fe===Oo||fe===bh||fe===yh,Pe=Te.getClearColor(),Ce=Te.getClearAlpha(),Ve=Pe.r,qe=Pe.g,ke=Pe.b;Ee?(A[0]=Ve,A[1]=qe,A[2]=ke,A[3]=Ce,B.clearBufferuiv(B.COLOR,0,A)):(g[0]=Ve,g[1]=qe,g[2]=ke,g[3]=Ce,B.clearBufferiv(B.COLOR,0,g))}else W|=B.COLOR_BUFFER_BIT}F&&(W|=B.DEPTH_BUFFER_BIT),z&&(W|=B.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),B.clear(W)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",me,!1),t.removeEventListener("webglcontextrestored",we,!1),t.removeEventListener("webglcontextcreationerror",le,!1),Te.dispose(),J.dispose(),De.dispose(),oe.dispose(),We.dispose(),Xe.dispose(),k.dispose(),_e.dispose(),Je.dispose(),X.dispose(),de.dispose(),de.removeEventListener("sessionstart",Sn),de.removeEventListener("sessionend",Yr),ui.stop()};function me(C){C.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),x=!0}function we(){console.log("THREE.WebGLRenderer: Context Restored."),x=!1;const C=Ae.autoReset,F=Be.enabled,z=Be.autoUpdate,W=Be.needsUpdate,O=Be.type;D(),Ae.autoReset=C,Be.enabled=F,Be.autoUpdate=z,Be.needsUpdate=W,Be.type=O}function le(C){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",C.statusMessage)}function ee(C){const F=C.target;F.removeEventListener("dispose",ee),Re(F)}function Re(C){Ye(C),oe.remove(C)}function Ye(C){const F=oe.get(C).programs;F!==void 0&&(F.forEach(function(z){X.releaseProgram(z)}),C.isShaderMaterial&&X.releaseShaderCache(C))}this.renderBufferDirect=function(C,F,z,W,O,fe){F===null&&(F=Se);const Ee=O.isMesh&&O.matrixWorld.determinant()<0,Pe=ld(C,F,z,W,O);Z.setMaterial(W,Ee);let Ce=z.index,Ve=1;if(W.wireframe===!0){if(Ce=M.getWireframeAttribute(z),Ce===void 0)return;Ve=2}const qe=z.drawRange,ke=z.attributes.position;let ot=qe.start*Ve,xt=(qe.start+qe.count)*Ve;fe!==null&&(ot=Math.max(ot,fe.start*Ve),xt=Math.min(xt,(fe.start+fe.count)*Ve)),Ce!==null?(ot=Math.max(ot,0),xt=Math.min(xt,Ce.count)):ke!=null&&(ot=Math.max(ot,0),xt=Math.min(xt,ke.count));const Ft=xt-ot;if(Ft<0||Ft===1/0)return;_e.setup(O,W,Pe,z,Ce);let It,bt=xe;if(Ce!==null&&(It=T.get(Ce),bt=He,bt.setIndex(It)),O.isMesh)W.wireframe===!0?(Z.setLineWidth(W.wireframeLinewidth*Ie()),bt.setMode(B.LINES)):bt.setMode(B.TRIANGLES);else if(O.isLine){let Ge=W.linewidth;Ge===void 0&&(Ge=1),Z.setLineWidth(Ge*Ie()),O.isLineSegments?bt.setMode(B.LINES):O.isLineLoop?bt.setMode(B.LINE_LOOP):bt.setMode(B.LINE_STRIP)}else O.isPoints?bt.setMode(B.POINTS):O.isSprite&&bt.setMode(B.TRIANGLES);if(O.isBatchedMesh)if(O._multiDrawInstances!==null)Yo("THREE.WebGLRenderer: renderMultiDrawInstances has been deprecated and will be removed in r184. Append to renderMultiDraw arguments and use indirection."),bt.renderMultiDrawInstances(O._multiDrawStarts,O._multiDrawCounts,O._multiDrawCount,O._multiDrawInstances);else if(j.get("WEBGL_multi_draw"))bt.renderMultiDraw(O._multiDrawStarts,O._multiDrawCounts,O._multiDrawCount);else{const Ge=O._multiDrawStarts,Dt=O._multiDrawCounts,ht=O._multiDrawCount,mn=Ce?T.get(Ce).bytesPerElement:1,Ps=oe.get(W).currentProgram.getUniforms();for(let gn=0;gn<ht;gn++)Ps.setValue(B,"_gl_DrawID",gn),bt.render(Ge[gn]/mn,Dt[gn])}else if(O.isInstancedMesh)bt.renderInstances(ot,Ft,O.count);else if(z.isInstancedBufferGeometry){const Ge=z._maxInstanceCount!==void 0?z._maxInstanceCount:1/0,Dt=Math.min(z.instanceCount,Ge);bt.renderInstances(ot,Ft,Dt)}else bt.render(ot,Ft)};function At(C,F,z){C.transparent===!0&&C.side===nn&&C.forceSinglePass===!1?(C.side=Yt,C.needsUpdate=!0,zi(C,F,z),C.side=Ci,C.needsUpdate=!0,zi(C,F,z),C.side=nn):zi(C,F,z)}this.compile=function(C,F,z=null){z===null&&(z=C),p=De.get(z),p.init(F),v.push(p),z.traverseVisible(function(O){O.isLight&&O.layers.test(F.layers)&&(p.pushLight(O),O.castShadow&&p.pushShadow(O))}),C!==z&&C.traverseVisible(function(O){O.isLight&&O.layers.test(F.layers)&&(p.pushLight(O),O.castShadow&&p.pushShadow(O))}),p.setupLights();const W=new Set;return C.traverse(function(O){if(!(O.isMesh||O.isPoints||O.isLine||O.isSprite))return;const fe=O.material;if(fe)if(Array.isArray(fe))for(let Ee=0;Ee<fe.length;Ee++){const Pe=fe[Ee];At(Pe,z,O),W.add(Pe)}else At(fe,z,O),W.add(fe)}),p=v.pop(),W},this.compileAsync=function(C,F,z=null){const W=this.compile(C,F,z);return new Promise(O=>{function fe(){if(W.forEach(function(Ee){oe.get(Ee).currentProgram.isReady()&&W.delete(Ee)}),W.size===0){O(C);return}setTimeout(fe,10)}j.get("KHR_parallel_shader_compile")!==null?fe():setTimeout(fe,10)})};let ut=null;function Nn(C){ut&&ut(C)}function Sn(){ui.stop()}function Yr(){ui.start()}const ui=new em;ui.setAnimationLoop(Nn),typeof self<"u"&&ui.setContext(self),this.setAnimationLoop=function(C){ut=C,de.setAnimationLoop(C),C===null?ui.stop():ui.start()},de.addEventListener("sessionstart",Sn),de.addEventListener("sessionend",Yr),this.render=function(C,F){if(F!==void 0&&F.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(x===!0)return;if(C.matrixWorldAutoUpdate===!0&&C.updateMatrixWorld(),F.parent===null&&F.matrixWorldAutoUpdate===!0&&F.updateMatrixWorld(),de.enabled===!0&&de.isPresenting===!0&&(de.cameraAutoUpdate===!0&&de.updateCamera(F),F=de.getCamera()),C.isScene===!0&&C.onBeforeRender(_,C,F,L),p=De.get(C,v.length),p.init(F),v.push(p),ne.multiplyMatrices(F.projectionMatrix,F.matrixWorldInverse),Ke.setFromProjectionMatrix(ne,ii,F.reversedDepth),K=this.localClippingEnabled,$e=he.init(this.clippingPlanes,K),m=J.get(C,E.length),m.init(),E.push(m),de.enabled===!0&&de.isPresenting===!0){const fe=_.xr.getDepthSensingMesh();fe!==null&&jr(fe,F,-1/0,_.sortObjects)}jr(C,F,0,_.sortObjects),m.finish(),_.sortObjects===!0&&m.sort(te,se),re=de.enabled===!1||de.isPresenting===!1||de.hasDepthSensing()===!1,re&&Te.addToRenderList(m,C),this.info.render.frame++,$e===!0&&he.beginShadows();const z=p.state.shadowsArray;Be.render(z,C,F),$e===!0&&he.endShadows(),this.info.autoReset===!0&&this.info.reset();const W=m.opaque,O=m.transmissive;if(p.setupLights(),F.isArrayCamera){const fe=F.cameras;if(O.length>0)for(let Ee=0,Pe=fe.length;Ee<Pe;Ee++){const Ce=fe[Ee];la(W,O,C,Ce)}re&&Te.render(C);for(let Ee=0,Pe=fe.length;Ee<Pe;Ee++){const Ce=fe[Ee];aa(m,C,Ce,Ce.viewport)}}else O.length>0&&la(W,O,C,F),re&&Te.render(C),aa(m,C,F);L!==null&&I===0&&(pe.updateMultisampleRenderTarget(L),pe.updateRenderTargetMipmap(L)),C.isScene===!0&&C.onAfterRender(_,C,F),_e.resetDefaultState(),y=-1,b=null,v.pop(),v.length>0?(p=v[v.length-1],$e===!0&&he.setGlobalState(_.clippingPlanes,p.state.camera)):p=null,E.pop(),E.length>0?m=E[E.length-1]:m=null};function jr(C,F,z,W){if(C.visible===!1)return;if(C.layers.test(F.layers)){if(C.isGroup)z=C.renderOrder;else if(C.isLOD)C.autoUpdate===!0&&C.update(F);else if(C.isLight)p.pushLight(C),C.castShadow&&p.pushShadow(C);else if(C.isSprite){if(!C.frustumCulled||Ke.intersectsSprite(C)){W&&Le.setFromMatrixPosition(C.matrixWorld).applyMatrix4(ne);const Ee=k.update(C),Pe=C.material;Pe.visible&&m.push(C,Ee,Pe,z,Le.z,null)}}else if((C.isMesh||C.isLine||C.isPoints)&&(!C.frustumCulled||Ke.intersectsObject(C))){const Ee=k.update(C),Pe=C.material;if(W&&(C.boundingSphere!==void 0?(C.boundingSphere===null&&C.computeBoundingSphere(),Le.copy(C.boundingSphere.center)):(Ee.boundingSphere===null&&Ee.computeBoundingSphere(),Le.copy(Ee.boundingSphere.center)),Le.applyMatrix4(C.matrixWorld).applyMatrix4(ne)),Array.isArray(Pe)){const Ce=Ee.groups;for(let Ve=0,qe=Ce.length;Ve<qe;Ve++){const ke=Ce[Ve],ot=Pe[ke.materialIndex];ot&&ot.visible&&m.push(C,Ee,ot,z,Le.z,ke)}}else Pe.visible&&m.push(C,Ee,Pe,z,Le.z,null)}}const fe=C.children;for(let Ee=0,Pe=fe.length;Ee<Pe;Ee++)jr(fe[Ee],F,z,W)}function aa(C,F,z,W){const O=C.opaque,fe=C.transmissive,Ee=C.transparent;p.setupLightsView(z),$e===!0&&he.setGlobalState(_.clippingPlanes,z),W&&Z.viewport(R.copy(W)),O.length>0&&Bs(O,F,z),fe.length>0&&Bs(fe,F,z),Ee.length>0&&Bs(Ee,F,z),Z.buffers.depth.setTest(!0),Z.buffers.depth.setMask(!0),Z.buffers.color.setMask(!0),Z.setPolygonOffset(!1)}function la(C,F,z,W){if((z.isScene===!0?z.overrideMaterial:null)!==null)return;p.state.transmissionRenderTarget[W.id]===void 0&&(p.state.transmissionRenderTarget[W.id]=new ys(1,1,{generateMipmaps:!0,type:j.has("EXT_color_buffer_half_float")||j.has("EXT_color_buffer_float")?Ln:tt,minFilter:Gn,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:lt.workingColorSpace}));const fe=p.state.transmissionRenderTarget[W.id],Ee=W.viewport||R;fe.setSize(Ee.z*_.transmissionResolutionScale,Ee.w*_.transmissionResolutionScale);const Pe=_.getRenderTarget(),Ce=_.getActiveCubeFace(),Ve=_.getActiveMipmapLevel();_.setRenderTarget(fe),_.getClearColor(G),V=_.getClearAlpha(),V<1&&_.setClearColor(16777215,.5),_.clear(),re&&Te.render(z);const qe=_.toneMapping;_.toneMapping=Hi;const ke=W.viewport;if(W.viewport!==void 0&&(W.viewport=void 0),p.setupLightsView(W),$e===!0&&he.setGlobalState(_.clippingPlanes,W),Bs(C,z,W),pe.updateMultisampleRenderTarget(fe),pe.updateRenderTargetMipmap(fe),j.has("WEBGL_multisampled_render_to_texture")===!1){let ot=!1;for(let xt=0,Ft=F.length;xt<Ft;xt++){const It=F[xt],bt=It.object,Ge=It.geometry,Dt=It.material,ht=It.group;if(Dt.side===nn&&bt.layers.test(W.layers)){const mn=Dt.side;Dt.side=Yt,Dt.needsUpdate=!0,Ls(bt,z,W,Ge,Dt,ht),Dt.side=mn,Dt.needsUpdate=!0,ot=!0}}ot===!0&&(pe.updateMultisampleRenderTarget(fe),pe.updateRenderTargetMipmap(fe))}_.setRenderTarget(Pe,Ce,Ve),_.setClearColor(G,V),ke!==void 0&&(W.viewport=ke),_.toneMapping=qe}function Bs(C,F,z){const W=F.isScene===!0?F.overrideMaterial:null;for(let O=0,fe=C.length;O<fe;O++){const Ee=C[O],Pe=Ee.object,Ce=Ee.geometry,Ve=Ee.group;let qe=Ee.material;qe.allowOverride===!0&&W!==null&&(qe=W),Pe.layers.test(z.layers)&&Ls(Pe,F,z,Ce,qe,Ve)}}function Ls(C,F,z,W,O,fe){C.onBeforeRender(_,F,z,W,O,fe),C.modelViewMatrix.multiplyMatrices(z.matrixWorldInverse,C.matrixWorld),C.normalMatrix.getNormalMatrix(C.modelViewMatrix),O.onBeforeRender(_,F,z,W,C,fe),O.transparent===!0&&O.side===nn&&O.forceSinglePass===!1?(O.side=Yt,O.needsUpdate=!0,_.renderBufferDirect(z,F,W,O,C,fe),O.side=Ci,O.needsUpdate=!0,_.renderBufferDirect(z,F,W,O,C,fe),O.side=nn):_.renderBufferDirect(z,F,W,O,C,fe),C.onAfterRender(_,F,z,W,O,fe)}function zi(C,F,z){F.isScene!==!0&&(F=Se);const W=oe.get(C),O=p.state.lights,fe=p.state.shadowsArray,Ee=O.state.version,Pe=X.getParameters(C,O.state,fe,F,z),Ce=X.getProgramCacheKey(Pe);let Ve=W.programs;W.environment=C.isMeshStandardMaterial?F.environment:null,W.fog=F.fog,W.envMap=(C.isMeshStandardMaterial?Xe:We).get(C.envMap||W.environment),W.envMapRotation=W.environment!==null&&C.envMap===null?F.environmentRotation:C.envMapRotation,Ve===void 0&&(C.addEventListener("dispose",ee),Ve=new Map,W.programs=Ve);let qe=Ve.get(Ce);if(qe!==void 0){if(W.currentProgram===qe&&W.lightsStateVersion===Ee)return ua(C,Pe),qe}else Pe.uniforms=X.getUniforms(C),C.onBeforeCompile(Pe,_),qe=X.acquireProgram(Pe,Ce),Ve.set(Ce,qe),W.uniforms=Pe.uniforms;const ke=W.uniforms;return(!C.isShaderMaterial&&!C.isRawShaderMaterial||C.clipping===!0)&&(ke.clippingPlanes=he.uniform),ua(C,Pe),W.needsLights=ha(C),W.lightsStateVersion=Ee,W.needsLights&&(ke.ambientLightColor.value=O.state.ambient,ke.lightProbe.value=O.state.probe,ke.directionalLights.value=O.state.directional,ke.directionalLightShadows.value=O.state.directionalShadow,ke.spotLights.value=O.state.spot,ke.spotLightShadows.value=O.state.spotShadow,ke.rectAreaLights.value=O.state.rectArea,ke.ltc_1.value=O.state.rectAreaLTC1,ke.ltc_2.value=O.state.rectAreaLTC2,ke.pointLights.value=O.state.point,ke.pointLightShadows.value=O.state.pointShadow,ke.hemisphereLights.value=O.state.hemi,ke.directionalShadowMap.value=O.state.directionalShadowMap,ke.directionalShadowMatrix.value=O.state.directionalShadowMatrix,ke.spotShadowMap.value=O.state.spotShadowMap,ke.spotLightMatrix.value=O.state.spotLightMatrix,ke.spotLightMap.value=O.state.spotLightMap,ke.pointShadowMap.value=O.state.pointShadowMap,ke.pointShadowMatrix.value=O.state.pointShadowMatrix),W.currentProgram=qe,W.uniformsList=null,qe}function ca(C){if(C.uniformsList===null){const F=C.currentProgram.getUniforms();C.uniformsList=ol.seqWithValue(F.seq,C.uniforms)}return C.uniformsList}function ua(C,F){const z=oe.get(C);z.outputColorSpace=F.outputColorSpace,z.batching=F.batching,z.batchingColor=F.batchingColor,z.instancing=F.instancing,z.instancingColor=F.instancingColor,z.instancingMorph=F.instancingMorph,z.skinning=F.skinning,z.morphTargets=F.morphTargets,z.morphNormals=F.morphNormals,z.morphColors=F.morphColors,z.morphTargetsCount=F.morphTargetsCount,z.numClippingPlanes=F.numClippingPlanes,z.numIntersection=F.numClipIntersection,z.vertexAlphas=F.vertexAlphas,z.vertexTangents=F.vertexTangents,z.toneMapping=F.toneMapping}function ld(C,F,z,W,O){F.isScene!==!0&&(F=Se),pe.resetTextureUnits();const fe=F.fog,Ee=W.isMeshStandardMaterial?F.environment:null,Pe=L===null?_.outputColorSpace:L.isXRRenderTarget===!0?L.texture.colorSpace:rn,Ce=(W.isMeshStandardMaterial?Xe:We).get(W.envMap||Ee),Ve=W.vertexColors===!0&&!!z.attributes.color&&z.attributes.color.itemSize===4,qe=!!z.attributes.tangent&&(!!W.normalMap||W.anisotropy>0),ke=!!z.morphAttributes.position,ot=!!z.morphAttributes.normal,xt=!!z.morphAttributes.color;let Ft=Hi;W.toneMapped&&(L===null||L.isXRRenderTarget===!0)&&(Ft=_.toneMapping);const It=z.morphAttributes.position||z.morphAttributes.normal||z.morphAttributes.color,bt=It!==void 0?It.length:0,Ge=oe.get(W),Dt=p.state.lights;if($e===!0&&(K===!0||C!==b)){const on=C===b&&W.id===y;he.setState(W,C,on)}let ht=!1;W.version===Ge.__version?(Ge.needsLights&&Ge.lightsStateVersion!==Dt.state.version||Ge.outputColorSpace!==Pe||O.isBatchedMesh&&Ge.batching===!1||!O.isBatchedMesh&&Ge.batching===!0||O.isBatchedMesh&&Ge.batchingColor===!0&&O.colorTexture===null||O.isBatchedMesh&&Ge.batchingColor===!1&&O.colorTexture!==null||O.isInstancedMesh&&Ge.instancing===!1||!O.isInstancedMesh&&Ge.instancing===!0||O.isSkinnedMesh&&Ge.skinning===!1||!O.isSkinnedMesh&&Ge.skinning===!0||O.isInstancedMesh&&Ge.instancingColor===!0&&O.instanceColor===null||O.isInstancedMesh&&Ge.instancingColor===!1&&O.instanceColor!==null||O.isInstancedMesh&&Ge.instancingMorph===!0&&O.morphTexture===null||O.isInstancedMesh&&Ge.instancingMorph===!1&&O.morphTexture!==null||Ge.envMap!==Ce||W.fog===!0&&Ge.fog!==fe||Ge.numClippingPlanes!==void 0&&(Ge.numClippingPlanes!==he.numPlanes||Ge.numIntersection!==he.numIntersection)||Ge.vertexAlphas!==Ve||Ge.vertexTangents!==qe||Ge.morphTargets!==ke||Ge.morphNormals!==ot||Ge.morphColors!==xt||Ge.toneMapping!==Ft||Ge.morphTargetsCount!==bt)&&(ht=!0):(ht=!0,Ge.__version=W.version);let mn=Ge.currentProgram;ht===!0&&(mn=zi(W,F,O));let Ps=!1,gn=!1,Jr=!1;const Pt=mn.getUniforms(),wn=Ge.uniforms;if(Z.useProgram(mn.program)&&(Ps=!0,gn=!0,Jr=!0),W.id!==y&&(y=W.id,gn=!0),Ps||b!==C){Z.buffers.depth.getReversed()&&C.reversedDepth!==!0&&(C._reversedDepth=!0,C.updateProjectionMatrix()),Pt.setValue(B,"projectionMatrix",C.projectionMatrix),Pt.setValue(B,"viewMatrix",C.matrixWorldInverse);const pn=Pt.map.cameraPosition;pn!==void 0&&pn.setValue(B,be.setFromMatrixPosition(C.matrixWorld)),q.logarithmicDepthBuffer&&Pt.setValue(B,"logDepthBufFC",2/(Math.log(C.far+1)/Math.LN2)),(W.isMeshPhongMaterial||W.isMeshToonMaterial||W.isMeshLambertMaterial||W.isMeshBasicMaterial||W.isMeshStandardMaterial||W.isShaderMaterial)&&Pt.setValue(B,"isOrthographic",C.isOrthographicCamera===!0),b!==C&&(b=C,gn=!0,Jr=!0)}if(O.isSkinnedMesh){Pt.setOptional(B,O,"bindMatrix"),Pt.setOptional(B,O,"bindMatrixInverse");const on=O.skeleton;on&&(on.boneTexture===null&&on.computeBoneTexture(),Pt.setValue(B,"boneTexture",on.boneTexture,pe))}O.isBatchedMesh&&(Pt.setOptional(B,O,"batchingTexture"),Pt.setValue(B,"batchingTexture",O._matricesTexture,pe),Pt.setOptional(B,O,"batchingIdTexture"),Pt.setValue(B,"batchingIdTexture",O._indirectTexture,pe),Pt.setOptional(B,O,"batchingColorTexture"),O._colorsTexture!==null&&Pt.setValue(B,"batchingColorTexture",O._colorsTexture,pe));const Cn=z.morphAttributes;if((Cn.position!==void 0||Cn.normal!==void 0||Cn.color!==void 0)&&ue.update(O,z,mn),(gn||Ge.receiveShadow!==O.receiveShadow)&&(Ge.receiveShadow=O.receiveShadow,Pt.setValue(B,"receiveShadow",O.receiveShadow)),W.isMeshGouraudMaterial&&W.envMap!==null&&(wn.envMap.value=Ce,wn.flipEnvMap.value=Ce.isCubeTexture&&Ce.isRenderTargetTexture===!1?-1:1),W.isMeshStandardMaterial&&W.envMap===null&&F.environment!==null&&(wn.envMapIntensity.value=F.environmentIntensity),gn&&(Pt.setValue(B,"toneMappingExposure",_.toneMappingExposure),Ge.needsLights&&Zl(wn,Jr),fe&&W.fog===!0&&ie.refreshFogUniforms(wn,fe),ie.refreshMaterialUniforms(wn,W,H,Y,p.state.transmissionRenderTarget[C.id]),ol.upload(B,ca(Ge),wn,pe)),W.isShaderMaterial&&W.uniformsNeedUpdate===!0&&(ol.upload(B,ca(Ge),wn,pe),W.uniformsNeedUpdate=!1),W.isSpriteMaterial&&Pt.setValue(B,"center",O.center),Pt.setValue(B,"modelViewMatrix",O.modelViewMatrix),Pt.setValue(B,"normalMatrix",O.normalMatrix),Pt.setValue(B,"modelMatrix",O.matrixWorld),W.isShaderMaterial||W.isRawShaderMaterial){const on=W.uniformsGroups;for(let pn=0,tc=on.length;pn<tc;pn++){const Vi=on[pn];Je.update(Vi,mn),Je.bind(Vi,mn)}}return mn}function Zl(C,F){C.ambientLightColor.needsUpdate=F,C.lightProbe.needsUpdate=F,C.directionalLights.needsUpdate=F,C.directionalLightShadows.needsUpdate=F,C.pointLights.needsUpdate=F,C.pointLightShadows.needsUpdate=F,C.spotLights.needsUpdate=F,C.spotLightShadows.needsUpdate=F,C.rectAreaLights.needsUpdate=F,C.hemisphereLights.needsUpdate=F}function ha(C){return C.isMeshLambertMaterial||C.isMeshToonMaterial||C.isMeshPhongMaterial||C.isMeshStandardMaterial||C.isShadowMaterial||C.isShaderMaterial&&C.lights===!0}this.getActiveCubeFace=function(){return S},this.getActiveMipmapLevel=function(){return I},this.getRenderTarget=function(){return L},this.setRenderTargetTextures=function(C,F,z){const W=oe.get(C);W.__autoAllocateDepthBuffer=C.resolveDepthBuffer===!1,W.__autoAllocateDepthBuffer===!1&&(W.__useRenderToTexture=!1),oe.get(C.texture).__webglTexture=F,oe.get(C.depthTexture).__webglTexture=W.__autoAllocateDepthBuffer?void 0:z,W.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(C,F){const z=oe.get(C);z.__webglFramebuffer=F,z.__useDefaultFramebuffer=F===void 0};const $l=B.createFramebuffer();this.setRenderTarget=function(C,F=0,z=0){L=C,S=F,I=z;let W=!0,O=null,fe=!1,Ee=!1;if(C){const Ce=oe.get(C);if(Ce.__useDefaultFramebuffer!==void 0)Z.bindFramebuffer(B.FRAMEBUFFER,null),W=!1;else if(Ce.__webglFramebuffer===void 0)pe.setupRenderTarget(C);else if(Ce.__hasExternalTextures)pe.rebindTextures(C,oe.get(C.texture).__webglTexture,oe.get(C.depthTexture).__webglTexture);else if(C.depthBuffer){const ke=C.depthTexture;if(Ce.__boundDepthTexture!==ke){if(ke!==null&&oe.has(ke)&&(C.width!==ke.image.width||C.height!==ke.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");pe.setupDepthRenderbuffer(C)}}const Ve=C.texture;(Ve.isData3DTexture||Ve.isDataArrayTexture||Ve.isCompressedArrayTexture)&&(Ee=!0);const qe=oe.get(C).__webglFramebuffer;C.isWebGLCubeRenderTarget?(Array.isArray(qe[F])?O=qe[F][z]:O=qe[F],fe=!0):C.samples>0&&pe.useMultisampledRTT(C)===!1?O=oe.get(C).__webglMultisampledFramebuffer:Array.isArray(qe)?O=qe[z]:O=qe,R.copy(C.viewport),U.copy(C.scissor),N=C.scissorTest}else R.copy(ae).multiplyScalar(H).floor(),U.copy(ve).multiplyScalar(H).floor(),N=Oe;if(z!==0&&(O=$l),Z.bindFramebuffer(B.FRAMEBUFFER,O)&&W&&Z.drawBuffers(C,O),Z.viewport(R),Z.scissor(U),Z.setScissorTest(N),fe){const Ce=oe.get(C.texture);B.framebufferTexture2D(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_CUBE_MAP_POSITIVE_X+F,Ce.__webglTexture,z)}else if(Ee){const Ce=F;for(let Ve=0;Ve<C.textures.length;Ve++){const qe=oe.get(C.textures[Ve]);B.framebufferTextureLayer(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0+Ve,qe.__webglTexture,z,Ce)}}else if(C!==null&&z!==0){const Ce=oe.get(C.texture);B.framebufferTexture2D(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,Ce.__webglTexture,z)}y=-1},this.readRenderTargetPixels=function(C,F,z,W,O,fe,Ee,Pe=0){if(!(C&&C.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Ce=oe.get(C).__webglFramebuffer;if(C.isWebGLCubeRenderTarget&&Ee!==void 0&&(Ce=Ce[Ee]),Ce){Z.bindFramebuffer(B.FRAMEBUFFER,Ce);try{const Ve=C.textures[Pe],qe=Ve.format,ke=Ve.type;if(!q.textureFormatReadable(qe)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!q.textureTypeReadable(ke)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}F>=0&&F<=C.width-W&&z>=0&&z<=C.height-O&&(C.textures.length>1&&B.readBuffer(B.COLOR_ATTACHMENT0+Pe),B.readPixels(F,z,W,O,Fe.convert(qe),Fe.convert(ke),fe))}finally{const Ve=L!==null?oe.get(L).__webglFramebuffer:null;Z.bindFramebuffer(B.FRAMEBUFFER,Ve)}}},this.readRenderTargetPixelsAsync=async function(C,F,z,W,O,fe,Ee,Pe=0){if(!(C&&C.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Ce=oe.get(C).__webglFramebuffer;if(C.isWebGLCubeRenderTarget&&Ee!==void 0&&(Ce=Ce[Ee]),Ce)if(F>=0&&F<=C.width-W&&z>=0&&z<=C.height-O){Z.bindFramebuffer(B.FRAMEBUFFER,Ce);const Ve=C.textures[Pe],qe=Ve.format,ke=Ve.type;if(!q.textureFormatReadable(qe))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!q.textureTypeReadable(ke))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const ot=B.createBuffer();B.bindBuffer(B.PIXEL_PACK_BUFFER,ot),B.bufferData(B.PIXEL_PACK_BUFFER,fe.byteLength,B.STREAM_READ),C.textures.length>1&&B.readBuffer(B.COLOR_ATTACHMENT0+Pe),B.readPixels(F,z,W,O,Fe.convert(qe),Fe.convert(ke),0);const xt=L!==null?oe.get(L).__webglFramebuffer:null;Z.bindFramebuffer(B.FRAMEBUFFER,xt);const Ft=B.fenceSync(B.SYNC_GPU_COMMANDS_COMPLETE,0);return B.flush(),await t_(B,Ft,4),B.bindBuffer(B.PIXEL_PACK_BUFFER,ot),B.getBufferSubData(B.PIXEL_PACK_BUFFER,0,fe),B.deleteBuffer(ot),B.deleteSync(Ft),fe}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(C,F=null,z=0){const W=Math.pow(2,-z),O=Math.floor(C.image.width*W),fe=Math.floor(C.image.height*W),Ee=F!==null?F.x:0,Pe=F!==null?F.y:0;pe.setTexture2D(C,0),B.copyTexSubImage2D(B.TEXTURE_2D,z,0,0,Ee,Pe,O,fe),Z.unbindTexture()};const ec=B.createFramebuffer(),Ds=B.createFramebuffer();this.copyTextureToTexture=function(C,F,z=null,W=null,O=0,fe=null){fe===null&&(O!==0?(Yo("WebGLRenderer: copyTextureToTexture function signature has changed to support src and dst mipmap levels."),fe=O,O=0):fe=0);let Ee,Pe,Ce,Ve,qe,ke,ot,xt,Ft;const It=C.isCompressedTexture?C.mipmaps[fe]:C.image;if(z!==null)Ee=z.max.x-z.min.x,Pe=z.max.y-z.min.y,Ce=z.isBox3?z.max.z-z.min.z:1,Ve=z.min.x,qe=z.min.y,ke=z.isBox3?z.min.z:0;else{const Cn=Math.pow(2,-O);Ee=Math.floor(It.width*Cn),Pe=Math.floor(It.height*Cn),C.isDataArrayTexture?Ce=It.depth:C.isData3DTexture?Ce=Math.floor(It.depth*Cn):Ce=1,Ve=0,qe=0,ke=0}W!==null?(ot=W.x,xt=W.y,Ft=W.z):(ot=0,xt=0,Ft=0);const bt=Fe.convert(F.format),Ge=Fe.convert(F.type);let Dt;F.isData3DTexture?(pe.setTexture3D(F,0),Dt=B.TEXTURE_3D):F.isDataArrayTexture||F.isCompressedArrayTexture?(pe.setTexture2DArray(F,0),Dt=B.TEXTURE_2D_ARRAY):(pe.setTexture2D(F,0),Dt=B.TEXTURE_2D),B.pixelStorei(B.UNPACK_FLIP_Y_WEBGL,F.flipY),B.pixelStorei(B.UNPACK_PREMULTIPLY_ALPHA_WEBGL,F.premultiplyAlpha),B.pixelStorei(B.UNPACK_ALIGNMENT,F.unpackAlignment);const ht=B.getParameter(B.UNPACK_ROW_LENGTH),mn=B.getParameter(B.UNPACK_IMAGE_HEIGHT),Ps=B.getParameter(B.UNPACK_SKIP_PIXELS),gn=B.getParameter(B.UNPACK_SKIP_ROWS),Jr=B.getParameter(B.UNPACK_SKIP_IMAGES);B.pixelStorei(B.UNPACK_ROW_LENGTH,It.width),B.pixelStorei(B.UNPACK_IMAGE_HEIGHT,It.height),B.pixelStorei(B.UNPACK_SKIP_PIXELS,Ve),B.pixelStorei(B.UNPACK_SKIP_ROWS,qe),B.pixelStorei(B.UNPACK_SKIP_IMAGES,ke);const Pt=C.isDataArrayTexture||C.isData3DTexture,wn=F.isDataArrayTexture||F.isData3DTexture;if(C.isDepthTexture){const Cn=oe.get(C),on=oe.get(F),pn=oe.get(Cn.__renderTarget),tc=oe.get(on.__renderTarget);Z.bindFramebuffer(B.READ_FRAMEBUFFER,pn.__webglFramebuffer),Z.bindFramebuffer(B.DRAW_FRAMEBUFFER,tc.__webglFramebuffer);for(let Vi=0;Vi<Ce;Vi++)Pt&&(B.framebufferTextureLayer(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,oe.get(C).__webglTexture,O,ke+Vi),B.framebufferTextureLayer(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,oe.get(F).__webglTexture,fe,Ft+Vi)),B.blitFramebuffer(Ve,qe,Ee,Pe,ot,xt,Ee,Pe,B.DEPTH_BUFFER_BIT,B.NEAREST);Z.bindFramebuffer(B.READ_FRAMEBUFFER,null),Z.bindFramebuffer(B.DRAW_FRAMEBUFFER,null)}else if(O!==0||C.isRenderTargetTexture||oe.has(C)){const Cn=oe.get(C),on=oe.get(F);Z.bindFramebuffer(B.READ_FRAMEBUFFER,ec),Z.bindFramebuffer(B.DRAW_FRAMEBUFFER,Ds);for(let pn=0;pn<Ce;pn++)Pt?B.framebufferTextureLayer(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,Cn.__webglTexture,O,ke+pn):B.framebufferTexture2D(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,Cn.__webglTexture,O),wn?B.framebufferTextureLayer(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,on.__webglTexture,fe,Ft+pn):B.framebufferTexture2D(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,on.__webglTexture,fe),O!==0?B.blitFramebuffer(Ve,qe,Ee,Pe,ot,xt,Ee,Pe,B.COLOR_BUFFER_BIT,B.NEAREST):wn?B.copyTexSubImage3D(Dt,fe,ot,xt,Ft+pn,Ve,qe,Ee,Pe):B.copyTexSubImage2D(Dt,fe,ot,xt,Ve,qe,Ee,Pe);Z.bindFramebuffer(B.READ_FRAMEBUFFER,null),Z.bindFramebuffer(B.DRAW_FRAMEBUFFER,null)}else wn?C.isDataTexture||C.isData3DTexture?B.texSubImage3D(Dt,fe,ot,xt,Ft,Ee,Pe,Ce,bt,Ge,It.data):F.isCompressedArrayTexture?B.compressedTexSubImage3D(Dt,fe,ot,xt,Ft,Ee,Pe,Ce,bt,It.data):B.texSubImage3D(Dt,fe,ot,xt,Ft,Ee,Pe,Ce,bt,Ge,It):C.isDataTexture?B.texSubImage2D(B.TEXTURE_2D,fe,ot,xt,Ee,Pe,bt,Ge,It.data):C.isCompressedTexture?B.compressedTexSubImage2D(B.TEXTURE_2D,fe,ot,xt,It.width,It.height,bt,It.data):B.texSubImage2D(B.TEXTURE_2D,fe,ot,xt,Ee,Pe,bt,Ge,It);B.pixelStorei(B.UNPACK_ROW_LENGTH,ht),B.pixelStorei(B.UNPACK_IMAGE_HEIGHT,mn),B.pixelStorei(B.UNPACK_SKIP_PIXELS,Ps),B.pixelStorei(B.UNPACK_SKIP_ROWS,gn),B.pixelStorei(B.UNPACK_SKIP_IMAGES,Jr),fe===0&&F.generateMipmaps&&B.generateMipmap(Dt),Z.unbindTexture()},this.initRenderTarget=function(C){oe.get(C).__webglFramebuffer===void 0&&pe.setupRenderTarget(C)},this.initTexture=function(C){C.isCubeTexture?pe.setTextureCube(C,0):C.isData3DTexture?pe.setTexture3D(C,0):C.isDataArrayTexture||C.isCompressedArrayTexture?pe.setTexture2DArray(C,0):pe.setTexture2D(C,0),Z.unbindTexture()},this.resetState=function(){S=0,I=0,L=null,Z.reset(),_e.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return ii}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=lt._getDrawingBufferColorSpace(e),t.unpackColorSpace=lt._getUnpackColorSpace()}}const yt=n=>440*Math.pow(2,(n-69)/12);function IM(){return{ctx:null,muted:!1,musicOn:!0,master:null,sfx:null,music:null,crowd:null,noise:null,chargeVoice:null,seq:null,musicMode:"off"}}function ws(n){if(n.ctx){n.ctx.state==="suspended"&&n.ctx.resume();return}const e=window.AudioContext||window.webkitAudioContext;if(!e)return;const t=new e;n.ctx=t;const i=t.createDynamicsCompressor();i.threshold.value=-14,i.ratio.value=4,i.connect(t.destination),n.master=t.createGain(),n.master.gain.value=n.muted?0:.85,n.master.connect(i),n.sfx=t.createGain(),n.sfx.gain.value=1,n.sfx.connect(n.master),n.music=t.createGain(),n.music.gain.value=0,n.music.connect(n.master),n.crowd=t.createGain(),n.crowd.gain.value=0,n.crowd.connect(n.master);const s=t.sampleRate*2,r=t.createBuffer(1,s,t.sampleRate),o=r.getChannelData(0);for(let a=0;a<s;a++)o[a]=Math.random()*2-1;n.noise=r,PM(n),n.musicMode!=="off"&&Cs(n,n.musicMode)}function TM(n,e){n.muted=e,n.master&&n.master.gain.setTargetAtTime(e?0:.85,n.ctx.currentTime,.05)}function rm(n,e,t,i,s,r=1e-4){n.gain.cancelScheduledValues(e),n.gain.setValueAtTime(1e-4,e),n.gain.exponentialRampToValueAtTime(i,e+t),n.gain.exponentialRampToValueAtTime(Math.max(1e-4,r),e+t+s)}function at(n,e,t,i,s,r,o=n.sfx,a=null){const l=n.ctx.createOscillator();l.type=e,l.frequency.setValueAtTime(t,i),a&&l.frequency.exponentialRampToValueAtTime(a,i+s);const c=n.ctx.createGain();return rm(c,i,.004,r,s),l.connect(c).connect(o),l.start(i),l.stop(i+s+.05),l}function Ii(n,e,t,i,s,r,o=1,a=n.sfx,l=null){const c=n.ctx.createBufferSource();c.buffer=n.noise,c.loop=!0;const u=n.ctx.createBiquadFilter();u.type=s,u.frequency.setValueAtTime(r,e),l&&u.frequency.exponentialRampToValueAtTime(l,e+t),u.Q.value=o;const h=n.ctx.createGain();return rm(h,e,.003,i,t),c.connect(u).connect(h).connect(a),c.start(e,Math.random()*1.5),c.stop(e+t+.05),c}const Xn=n=>n.ctx&&n.ctx.state==="running";function RM(n,e=.5,t="nice",i="topspin"){if(!Xn(n))return;const s=n.ctx.currentTime,r=.6+e*.6;at(n,"sine",190+e*60,s,.09,.7*r,n.sfx,55),Ii(n,s,.035,.55*r,"bandpass",2600+e*1400,1.4),at(n,"triangle",i==="slice"||i==="drop"?520:760,s,.05,.18,n.sfx,380),t==="perfect"?([84,88,91,96].forEach((o,a)=>at(n,"square",yt(o),s+.03+a*.045,.16,.07)),Ii(n,s,.32,.22,"highpass",3e3,.7,n.sfx,9e3)):t==="great"&&[86,91].forEach((o,a)=>at(n,"square",yt(o),s+.03+a*.05,.1,.05))}function Pf(n,e=.6){Xn(n)&&Ii(n,n.ctx.currentTime,.22,.25*e,"bandpass",500,.9,n.sfx,2400)}function BM(n,e=10){if(!Xn(n))return;const t=n.ctx.currentTime,i=Math.min(1,e/25);at(n,"sine",260,t,.07,.25+i*.4,n.sfx,110),Ii(n,t,.02,.18+i*.2,"bandpass",1800,1.2)}function LM(n){if(!Xn(n))return;const e=n.ctx.currentTime;Ii(n,e,.25,.5,"lowpass",600,.8),at(n,"sine",120,e,.15,.4,n.sfx,60)}function DM(n){Xn(n)&&at(n,"sine",520,n.ctx.currentTime,.12,.12,n.sfx,820)}function en(n,e="move"){if(!Xn(n))return;const t=n.ctx.currentTime;e==="move"?at(n,"square",yt(84),t,.05,.06):e==="ok"?(at(n,"square",yt(84),t,.07,.08),at(n,"square",yt(91),t+.07,.12,.08)):e==="back"?(at(n,"square",yt(79),t,.07,.07),at(n,"square",yt(72),t+.06,.1,.07)):e==="pop"?at(n,"sine",660,t,.1,.25,n.sfx,1320):e==="stamp"&&(at(n,"sine",140,t,.18,.6,n.sfx,50),Ii(n,t,.08,.35,"lowpass",1400,.8))}function Ar(n,e){if(!Xn(n))return;const t=n.ctx.currentTime;if(e==="out"||e==="fault")at(n,"square",yt(76),t,.14,.09),at(n,"square",yt(70),t+.13,.22,.09);else if(e==="point")[72,76,79,84].forEach((i,s)=>at(n,"square",yt(i),t+s*.07,.14,.07)),[60,64].forEach((i,s)=>at(n,"triangle",yt(i),t+s*.14,.2,.2));else if(e==="lost")[71,67,64].forEach((i,s)=>at(n,"triangle",yt(i),t+s*.12,.2,.18));else if(e==="game"){const i=[72,76,79,84,79,84,88];i.forEach((s,r)=>at(n,"square",yt(s),t+r*.09,r===i.length-1?.5:.12,.08)),[48,55,60].forEach((s,r)=>at(n,"triangle",yt(s),t+r*.18,.3,.25))}else if(e==="win"){const i=[72,72,72,76,79,76,79,84],s=[.1,.1,.1,.2,.1,.1,.1,.8];let r=t;i.forEach((o,a)=>{at(n,"square",yt(o),r,s[a],.09),at(n,"square",yt(o-12),r,s[a],.04),r+=s[a]+.02}),[48,53,55,60].forEach((o,a)=>at(n,"triangle",yt(o),t+a*.3,.5,.25))}else e==="lose"?[67,66,65,64].forEach((i,s)=>at(n,"triangle",yt(i),t+s*.25,.35,.18)):e==="ready"?at(n,"square",yt(79),t,.1,.08):e==="go"&&(at(n,"square",yt(91),t,.3,.09),at(n,"square",yt(84),t,.3,.06))}function PM(n){const e=n.ctx,t=e.createBufferSource();t.buffer=n.noise,t.loop=!0;const i=e.createBiquadFilter();i.type="bandpass",i.frequency.value=700,i.Q.value=.4;const s=e.createGain();s.gain.value=.05,t.connect(i).connect(s).connect(n.crowd),t.start(),n.crowdBed=s}function Vh(n,e){n.ctx&&n.crowd.gain.setTargetAtTime(e,n.ctx.currentTime,.4)}function Uf(n,e=1){if(!Xn(n))return;const t=n.ctx.currentTime,i=1.2+e*1.2,s=n.ctx.createBufferSource();s.buffer=n.noise,s.loop=!0;const r=n.ctx.createBiquadFilter();r.type="bandpass",r.frequency.value=1100,r.Q.value=.5;const o=n.ctx.createGain();o.gain.setValueAtTime(1e-4,t),o.gain.exponentialRampToValueAtTime(.35*e,t+.18),o.gain.exponentialRampToValueAtTime(1e-4,t+i),s.connect(r).connect(o).connect(n.sfx),s.start(t,Math.random()),s.stop(t+i+.1);const a=Math.round(40*e+20);for(let l=0;l<a;l++){const c=t+Math.random()*i*.9;Ii(n,c,.025,.08+Math.random()*.08,"bandpass",1400+Math.random()*1800,2)}if(e>.8)for(let l=0;l<2;l++){const c=t+.2+Math.random()*.6;at(n,"sine",1900+Math.random()*400,c,.35,.05,n.sfx,2600)}}function UM(n){if(!Xn(n))return;const e=n.ctx.currentTime,t=n.ctx.createBufferSource();t.buffer=n.noise,t.loop=!0;const i=n.ctx.createBiquadFilter();i.type="bandpass",i.Q.value=3,i.frequency.setValueAtTime(700,e),i.frequency.exponentialRampToValueAtTime(380,e+1);const s=n.ctx.createGain();s.gain.setValueAtTime(1e-4,e),s.gain.exponentialRampToValueAtTime(.4,e+.15),s.gain.exponentialRampToValueAtTime(1e-4,e+1.1),t.connect(i).connect(s).connect(n.sfx),t.start(e,Math.random()),t.stop(e+1.2)}function FM(n,e){if(!Xn(n)||n.chargeVoice)return;const t=n.ctx,i=t.currentTime,s=t.createOscillator();s.type="sawtooth";const r=e==="lob"?330:e==="slice"?260:e==="drop"?230:e==="topspin"?320:300;s.frequency.setValueAtTime(r,i),s.frequency.exponentialRampToValueAtTime(r*2.6,i+.9);const o=t.createBiquadFilter();o.type="lowpass",o.frequency.setValueAtTime(600,i),o.frequency.exponentialRampToValueAtTime(3200,i+.9);const a=t.createOscillator();a.frequency.value=18;const l=t.createGain();l.gain.value=.025;const c=t.createGain();c.gain.setValueAtTime(1e-4,i),c.gain.exponentialRampToValueAtTime(.05,i+.08),a.connect(l).connect(c.gain),s.connect(o).connect(c).connect(n.sfx),s.start(i),a.start(i),n.chargeVoice={o:s,g:c,trem:a,fullAt:i+.9,dinged:!1}}function NM(n,e){const t=n.chargeVoice;!t||!Xn(n)||e>=1&&!t.dinged&&(t.dinged=!0,at(n,"square",yt(96),n.ctx.currentTime,.14,.06))}function Po(n){const e=n.chargeVoice;if(!e||!n.ctx)return;const t=n.ctx.currentTime;e.g.gain.cancelScheduledValues(t),e.g.gain.setTargetAtTime(1e-4,t,.02),e.o.stop(t+.15),e.trem.stop(t+.15),n.chargeVoice=null}const OM=138,kM=[[48,52,55,60],[45,52,57,60],[41,48,53,57],[43,50,55,59],[48,52,55,64],[45,52,57,64],[38,50,53,57],[43,50,55,62]],Ff=[[76,79,84,-1,79,-1,76,79],[81,-1,76,-1,72,76,81,-1],[77,81,84,-1,81,77,81,84],[86,-1,83,-1,79,-1,-1,0],[76,79,84,88,86,84,79,76],[81,84,88,-1,86,84,81,-1],[77,-1,81,86,-1,84,81,77],[79,81,83,86,-1,83,79,0]];function Cs(n,e="title"){if(n.musicMode=e,!n.ctx)return;const t=e==="off"||e==="match"?0:e==="soft"?.18:.32;if(n.music.gain.setTargetAtTime(n.musicOn?t:0,n.ctx.currentTime,.3),e==="off"||n.seq)return;const i=n.ctx,s=60/OM/2,r={step:0,next:i.currentTime+.1,timer:0},o=()=>{for(;r.next<i.currentTime+.2;){const a=Math.floor(r.step/8)%8,l=r.step%8,c=r.next,u=kM[a];if(n.musicMode==="match"||n.musicMode==="off"||n.muted){r.step+=1,r.next+=s;continue}if(l%2===0?at(n,"triangle",yt(u[0]-12+(l===4?7:0)),c,s*1.6,.34,n.music):at(n,"triangle",yt(u[0]),c,s*.7,.18,n.music),l%2===1)for(const d of u.slice(1))at(n,"square",yt(d+12),c,s*.55,.022,n.music);const h=Ff[a][l];if(h>0){let d=1;for(;l+d<8&&Ff[a][l+d]===-1;)d++;at(n,"square",yt(h),c,s*d*.92,.055,n.music),at(n,"triangle",yt(h+12),c,s*d*.6,.03,n.music)}(l===0||l===4)&&at(n,"sine",150,c,.12,.5,n.music,45),(l===2||l===6)&&Ii(n,c,.12,.2,"bandpass",1800,.7,n.music),Ii(n,c,.03,l%2?.06:.035,"highpass",7e3,.7,n.music),r.step+=1,r.next+=s}};r.timer=setInterval(o,40),o(),n.seq=r}function QM(n){n.seq&&clearInterval(n.seq.timer),n.seq=null,Po(n),n.ctx&&n.ctx.close(),n.ctx=null}let Ui=null;function HM(){if(Ui)return Ui;const n=new Uint8Array([90,90,90,255,175,175,175,255,255,255,255,255]);return Ui=new Vl(n,3,1,Ht),Ui.minFilter=Gt,Ui.magFilter=Gt,Ui.generateMipmaps=!1,Ui.needsUpdate=!0,Ui}const Hc=new Map;function st(n,e={}){const t=`${n}|${e.emissive||0}|${e.map?e.map.uuid:""}|${e.transparent?1:0}`;if(!e.unique&&Hc.has(t))return Hc.get(t);const i=new Oh({color:n,gradientMap:HM(),emissive:e.emissive||0,map:e.map||null,transparent:!!e.transparent});return e.unique||Hc.set(t,i),i}const Gc=new Map;function GM(n=.018,e=1907246){const t=`${n}|${e}`;if(Gc.has(t))return Gc.get(t);const i=new Mn({uniforms:{width:{value:n},color:{value:new ye(e)}},vertexShader:`
      uniform float width;
      void main() {
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // Constant-ish screen thickness: grow with distance a little.
        float w = width * clamp(-mv.z * 0.12, 0.6, 2.2);
        mv.xyz += n * w;
        gl_Position = projectionMatrix * mv;
      }`,fragmentShader:`
      uniform vec3 color;
      void main() { gl_FragColor = vec4(color, 1.0); }`,side:Yt});return Gc.set(t,i),i}function Ei(n,e,t){const i=new Me(n.geometry,GM(e,t));return i.name="outline",i.castShadow=!1,i.receiveShadow=!1,n.add(i),i}const ct=(n,e,t)=>new w(n,e,-t),zc=new w,zM=new w,Nf=new je,Of=new Qe,$t=n=>n*n*(3-2*n),lo=n=>Math.max(0,Math.min(1,n)),co=(n,e,t,i)=>n+(e-n)*(1-Math.exp(-t*i));function Vc(n,e,t,i,s,r){const o=1-r;return n.set(0,0,0).addScaledVector(e,o*o*o).addScaledVector(t,3*o*o*r).addScaledVector(i,3*o*r*r).addScaledVector(s,r*r*r),n}const kf=256,Wc={};function Wh(n){if(Wc[n])return Wc[n];const e=document.createElement("canvas");e.width=e.height=kf;const t=e.getContext("2d"),i=kf;t.clearRect(0,0,i,i);const s="#1d1a2e",r=(u,h,d,f=0)=>{t.save(),t.translate(u*i,h*i),d<=.15?(t.strokeStyle=s,t.lineWidth=i*.028,t.lineCap="round",t.beginPath(),n==="happy"?t.arc(0,i*.02,i*.05,Math.PI*1.1,Math.PI*1.9):(t.moveTo(-i*.045,0),t.lineTo(i*.045,0)),t.stroke()):(t.fillStyle=s,t.beginPath(),t.ellipse(f*i*.01,0,i*.038,i*.062*d,0,0,Math.PI*2),t.fill(),t.fillStyle="#fff",t.beginPath(),t.arc(i*.012+f*i*.01,-i*.025*d,i*.014,0,Math.PI*2),t.fill()),t.restore()},o=(u,h,d)=>{t.save(),t.translate(u*i,h*i),t.rotate(d),t.fillStyle=s,t.beginPath(),t.roundRect(-i*.05,-i*.012,i*.1,i*.024,i*.012),t.fill(),t.restore()},a=()=>{t.fillStyle="rgba(255,120,140,0.45)";for(const u of[.28,.72])t.beginPath(),t.ellipse(u*i,.62*i,i*.055,i*.03,0,0,Math.PI*2),t.fill()},l=u=>{t.strokeStyle=s,t.fillStyle=s,t.lineWidth=i*.024,t.lineCap="round",t.beginPath(),u==="smile"?(t.arc(i*.5,i*.62,i*.06,Math.PI*.15,Math.PI*.85),t.stroke()):u==="grin"?(t.moveTo(i*.42,i*.64),t.quadraticCurveTo(i*.5,i*.76,i*.58,i*.64),t.closePath(),t.fill(),t.fillStyle="#ff7a8a",t.beginPath(),t.ellipse(i*.5,i*.695,i*.035,i*.018,0,0,Math.PI*2),t.fill()):u==="o"?(t.ellipse(i*.5,i*.67,i*.032,i*.042,0,0,Math.PI*2),t.fill()):u==="frown"?(t.arc(i*.5,i*.72,i*.05,Math.PI*1.2,Math.PI*1.8),t.stroke()):(t.moveTo(i*.46,i*.66),t.lineTo(i*.54,i*.66),t.stroke())};if(n==="neutral"||n==="blink"){const u=n==="blink"?0:1;r(.38,.47,u),r(.62,.47,u),o(.37,.35,-.08),o(.63,.35,.08),a(),l("smile")}else n==="focus"?(r(.38,.48,.8),r(.62,.48,.8),o(.37,.37,.28),o(.63,.37,-.28),l("flat")):n==="shout"?(r(.38,.47,.75),r(.62,.47,.75),o(.37,.36,.32),o(.63,.36,-.32),l("o")):n==="happy"?(r(.38,.47,0),r(.62,.47,0),o(.37,.33,-.15),o(.63,.33,.15),a(),l("grin")):n==="sad"&&(r(.38,.5,.55),r(.62,.5,.55),o(.37,.38,-.35),o(.63,.38,.35),l("frown"));const c=new Gr(e);return c.colorSpace=Bt,c.anisotropy=4,Wc[n]=c,c}function VM(){const n=document.createElement("canvas");n.width=n.height=128;const e=n.getContext("2d");e.clearRect(0,0,128,128),e.strokeStyle="rgba(255,255,255,0.9)",e.lineWidth=2;for(let i=4;i<128;i+=11)e.beginPath(),e.moveTo(i,0),e.lineTo(i,128),e.stroke(),e.beginPath(),e.moveTo(0,i),e.lineTo(128,i),e.stroke();const t=new Gr(n);return t.colorSpace=Bt,t}let Qf=null;function WM(n){const e=new Ct,t=new Me(new si(.022,.026,.2,10),st(2761536));t.position.y=.04,e.add(t);const i=new Me(new si(.014,.018,.16,8),st(n));i.position.y=.21,e.add(i);const s=new Me(new yr(.135,.016,8,28),st(n));s.scale.set(.82,1.08,1),s.position.y=.42,e.add(s),Ei(s,.008),Ei(t,.008),Qf||(Qf=VM());const r=new Me(new Bh(.128,24),new dn({map:Qf,transparent:!0,side:nn,depthWrite:!1,opacity:.9}));return r.scale.set(.82,1.08,1),r.position.y=.42,e.add(r),e.userData.head=s,e.scale.setScalar(1.25),e}function qM(n){const e=new VA;for(let t=0;t<10;t++){const i=t/10*Math.PI*2+Math.PI/2,s=t%2?n*.45:n,r=Math.cos(i)*s,o=Math.sin(i)*s;t===0?e.moveTo(r,o):e.lineTo(r,o)}return new Uh(e,{depth:.015,bevelEnabled:!1})}const Mr=[{shirt:16731486,shorts:16777215,band:16777215,racket:16731486,hair:4860959,skin:16765616,shoe:16777215,sole:16731486},{shirt:4029439,shorts:2042460,band:16765500,racket:4029439,hair:1775408,skin:15316108,shoe:2042460,sole:16765500},{shirt:2871678,shorts:16777215,band:1203258,racket:2871678,hair:15050810,skin:16769218,shoe:16777215,sole:2871678},{shirt:16756767,shorts:5913500,band:5913500,racket:16756767,hair:2759186,skin:13011551,shoe:5913500,sole:16756767}];function al(n=Mr[0],e={}){const t=new Ct,i=new Ct;t.add(i);const s={},r=st(n.shirt),o=new Me(new jo(.25,.2,6,16),r);o.position.y=.98,o.scale.set(1,1,.86),o.castShadow=!0,i.add(o),Ei(o,.016);const a=new Me(new Xt(.262,18,10,0,Math.PI*2,Math.PI*.55,Math.PI*.45),st(n.shorts));a.position.y=.92,a.scale.set(1,1.05,.88),i.add(a);const l=new Me(new si(.255,.255,.07,20,1,!0),st(n.band===16777215?16777215:n.band));l.position.y=1.08,l.scale.set(1,1,.86),i.add(l);const c=new Me(qM(.09),st(16777215));c.position.set(0,.96,.222),i.add(c);const u=new Me(new yr(.12,.022,8,20),st(16777215));u.rotation.x=Math.PI/2,u.position.y=1.3,i.add(u);const h=new Ct;h.position.y=1.6,i.add(h);const d=new Me(new Xt(.3,28,20),st(n.skin));d.scale.set(1,.96,.95),d.castShadow=!0,h.add(d),Ei(d,.016);const f=new Me(new Xt(.303,24,16,Math.PI*1.5-.95,1.9,Math.PI*.5-.85,1.7),new Oh({map:Wh("neutral"),transparent:!0,alphaTest:.05,depthWrite:!1}));f.scale.copy(d.scale),h.add(f);for(const y of[-1,1]){const b=new Me(new Xt(.06,10,8),st(n.skin));b.position.set(y*.29,-.02,.02),b.scale.set(.6,1,.8),h.add(b)}const A=st(n.hair),g=new Me(new Xt(.315,24,14,0,Math.PI*2,0,Math.PI*.42),A);g.rotation.x=.28,g.position.set(0,.02,.03),h.add(g),Ei(g,.014);const m=new Me(new Xt(.12,12,10),A);m.position.set(.12,.2,-.2),m.scale.set(1.5,.55,.8),m.rotation.z=-.4,h.add(m);const p=new Me(new Lh(.06,.16,8),A);p.position.set(-.04,.34,.05),p.rotation.z=.5,h.add(p);const E=new Me(new yr(.3,.035,8,32),st(n.band));E.rotation.x=Math.PI/2+.18,E.position.y=.1,E.scale.set(1.02,1,.97),h.add(E);const v=new Xt(.085,14,10),_=()=>{const y=new Ct,b=new Me(v,st(n.skin));b.castShadow=!0,y.add(b),Ei(b,.012);const R=new Me(new yr(.07,.03,8,16),st(n.band));return R.position.y=-.06,R.rotation.x=Math.PI/2,y.add(R),t.add(y),y};s.handR=_(),s.handL=_();const x=new jo(.075,.12,4,10),S=()=>{const y=new Ct,b=new Me(x,st(n.shoe));b.rotation.x=Math.PI/2,b.scale.set(1.15,1,.85),b.position.y=.07,b.castShadow=!0,y.add(b),Ei(b,.012);const R=new Me(new xn(.17,.035,.29),st(n.sole));return R.position.y=.018,y.add(R),t.add(y),y};s.footR=S(),s.footL=S();const I=WM(n.racket);t.add(I);const L={root:t,body:i,head:h,torso:o,face:f,racket:I,parts:s,palette:n,expression:"neutral",blinkAt:1+Math.random()*3,blinkUntil:0,gait:0,footPlant:[new w(.18,0,0),new w(-.18,0,0)],yaw:0,twist:0,lean:new ce,hop:0,hopV:0,squash:1,handR:new w,handL:new w,racketDir:new w(.6,.6,-.2).normalize(),racketPrev:new w,celebrate:0,time:0,charging:0,side:1,scale:e.scale||1};return t.scale.setScalar(L.scale),L}function Hf(n,e){n.expression!==e&&(n.expression=e,n.face.material.map=Wh(e),n.face.material.needsUpdate=!0)}const qt={ready:ct(.42,.95,.32),readyL:ct(-.3,.98,.28),fhBack:ct(.78,1.12,-.42),fhContact:ct(.82,.98,.38),fhFollow:ct(-.38,1.48,.2),bhBack:ct(-.72,1.06,-.38),bhContact:ct(-.78,.98,.4),bhFollow:ct(.42,1.5,.16),trophy:ct(.42,1.55,-.32),tossUp:ct(-.05,2.25,.4),serveContact:ct(.25,2.35,.35),serveFollow:ct(-.4,.9,.3)};function XM(n,e,t){const i=t.dt;n.time+=i;const s=n.root;s.position.set(e.x,t.lift||0,e.z);const r=e.side>0?0:Math.PI,o=t.faceYaw!==void 0?t.faceYaw:r+(t.yawBias||0);n.yaw=co(n.yaw,o,10,i),s.rotation.y=n.yaw;const a=Math.cos(-n.yaw),l=Math.sin(-n.yaw),c=e.vx*a-e.vz*l,u=e.vx*l+e.vz*a,h=Math.hypot(c,u),d=lo(h/6.5);n.gait+=i*(4+h*1.55);const f=.12+d*.32,A=h>.05?c/h:0,g=h>.05?u/h:0,m=[n.parts.footR,n.parts.footL];for(let P=0;P<2;P++){const Y=n.gait+P*Math.PI,H=Math.sin(Y),te=Math.max(0,Math.cos(Y))*(.06+d*.18),se=P===0?1:-1,ae=.2+(e.state==="charge"?.08:0);let ve=se*ae+A*H*f*(h>.2?1:0),Oe=g*H*f*(h>.2?1:0)+(P===0?.02:-.04),Ke=h>.2?te:0;e.state==="celebrate"&&(Ke+=n.hop*.6);const $e=m[P];$e.position.set(ve,Ke+n.hop,Oe),$e.rotation.set(h>.2?-H*.35*d:0,Math.atan2(A,-g||1)*.15*d,0)}t.hopNow&&(n.hopV=t.hopNow),n.hopV-=22*i,n.hop+=n.hopV*i,n.hop<=0&&(n.hopV<-1.2&&(n.squash=.82),n.hop=0,n.hopV=0),n.squash=co(n.squash,1,12,i);const p=h>.2?Math.abs(Math.sin(n.gait))*.05*(.4+d):Math.sin(n.time*3.2)*.012;let E=e.state==="charge"?.1:h<.3?.04:.02;e.state==="sad"&&(E=.12);const v=t.sink||0;E+=v,n.body.position.y=n.hop+p-E-.06,n.lean.x=co(n.lean.x,-c*.035,8,i),n.lean.y=co(n.lean.y,u*.035,8,i),n.body.rotation.z=n.lean.x,n.body.rotation.x=n.lean.y+(e.state==="sad"?.35:0)+v*.5,n.body.scale.set(1/Math.sqrt(n.squash),n.squash,1/Math.sqrt(n.squash));const _=n.handR,x=n.handL;let S=0;const I=e.swing,L=t.swingSide||1,y=t.contactHeight||1;if(I&&I.kind==="serve"){const P=lo(I.t/.42),Y=qt.trophy,H=qt.serveContact,te=qt.serveFollow;P<.18?_.lerpVectors(Y,H,$t(P/.18)):Vc(_,H,ct(.3,1.9,.9),ct(0,1,.8),te,$t((P-.18)/.82)),x.lerpVectors(ct(-.1,1.7,.35),ct(-.25,1,.3),$t(P)),S=wt.lerp(.5,-.6,$t(P))}else if(I&&(I.kind==="forehand"||I.kind==="backhand"||I.kind==="smash")){const P=lo(I.t/.46),Y=I.kind!=="backhand";if(I.kind==="smash")Vc(_,ct(.3,2.3,.3),ct(.5,2.1,.8),ct(.2,1.3,.8),ct(-.3,.9,.3),$t(P)),x.lerpVectors(ct(-.2,1.9,.4),ct(-.3,1,.2),$t(P)),S=wt.lerp(.4,-.7,$t(P));else{const H=Y?qt.fhBack:qt.bhBack,te=(Y?qt.fhContact:qt.bhContact).clone();te.y=Math.max(.35,Math.min(1.9,y));let se=Y?qt.fhFollow:qt.bhFollow;(I.shot==="slice"||I.shot==="drop")&&(se=Y?ct(-.2,.8,.6):ct(.3,.85,.6)),I.shot==="lob"&&(se=ct(Y?.1:.05,2,.4));const ae=.22+P*.78;ae<.32?_.lerpVectors(H,te,$t((ae-.22)/.1*.6+.4)):Vc(_,te,te.clone().add(ct(Y?-.25:.25,.15,.45)),se.clone().add(ct(0,-.1,.25)),se,$t((ae-.32)/.68)),Y?x.lerpVectors(ct(-.42,1.08,.28),ct(-.22,1.12,.12),$t(P)):x.copy(_).add(ct(.05,-.08,-.06)),S=Y?wt.lerp(.55,-.85,$t(P)):wt.lerp(-.6,.8,$t(P)),I.stretch&&(S*=.5)}}else if(e.state==="charge"){const P=L>0,Y=e.charge>=1?Math.sin(n.time*70)*.012:0,H=$t(lo(e.stateTime/.16));_.lerpVectors(qt.ready,P?qt.fhBack:qt.bhBack,H),_.y+=Y,P?x.lerpVectors(qt.readyL,ct(-.4,1.12,.38),H):x.copy(_).add(ct(.05,-.08,-.06)),S=(P?.6:-.65)*H}else if(e.state==="toss"){const P=lo(e.stateTime/.35);x.lerpVectors(ct(-.1,1,.4),qt.tossUp,$t(P)),_.lerpVectors(qt.ready,qt.trophy,$t(P)),S=.45*$t(P)}else if(e.state==="celebrate"){const P=Math.sin(n.time*9);_.set(.38,2.1+P*.12,-.1),x.set(-.38,2.1-P*.12,-.1),n.hop===0&&n.time%.9<i*1.5&&(n.hopV=4.2),Hf(n,"happy")}else if(e.state==="sad")_.set(.32,.7,-.15),x.set(-.3,.72,-.12);else{const P=Math.sin(n.time*3.2)*.015;if(_.copy(qt.ready),x.copy(qt.readyL),_.y+=P,x.y+=P,h>.5){const Y=Math.sin(n.gait)*.12*d;_.add(zc.set(.08*d,.05*d,Y)),x.add(zc.set(-.05*d,0,-Y))}}_.y+=n.body.position.y,x.y+=n.body.position.y,n.twist=co(n.twist,S,I?40:14,i),n.body.rotation.y=n.twist*.7,n.head.rotation.y=-n.twist*.45+(t.headYaw||0),n.head.rotation.x=(e.state==="sad"?.35:0)+(t.headPitch||0),n.parts.handR.position.copy(_),n.parts.handL.position.copy(x);const b=zc.set(.18,1.32+n.body.position.y,0),R=zM.copy(_).sub(b);I&&I.kind==="serve"&&I.t<.07&&R.set(.1,-1,.3),R.y+=.25,R.normalize(),n.racketDir.lerp(R,1-Math.exp(-(I?60:18)*i)).normalize();const U=n.racketPrev.copy(_).sub(n.racket.position);n.racket.position.copy(_);const N=n.racketDir;let G=U.lengthSq()>1e-6?U.normalize():new w(0,0,-1);G.addScaledVector(N,-G.dot(N)),G.lengthSq()<1e-4&&G.set(0,0,-1),G.normalize();const V=new w().crossVectors(N,G).normalize();if(Of.makeBasis(V,N,G),Nf.setFromRotationMatrix(Of),n.racket.quaternion.slerp(Nf,1-Math.exp(-(I?50:14)*i)),e.state!=="celebrate"){let P="neutral";e.state==="charge"?P=e.charge>.6?"shout":"focus":I&&I.t<.25?P="shout":e.state==="sad"?P="sad":t.mood==="happy"&&(P="happy"),P==="neutral"&&(n.time>n.blinkAt&&(n.blinkUntil=n.time+.12,n.blinkAt=n.time+2+Math.random()*3),n.time<n.blinkUntil&&(P="blink")),Hf(n,P)}}function YM(n,e=new w){return n.racket.userData.head.getWorldPosition(e)}function ih(n,e="happy"){const t=document.createElement("canvas");t.width=t.height=160;const i=t.getContext("2d"),s=o=>`#${o.toString(16).padStart(6,"0")}`;i.fillStyle=s(n.shirt),i.fillRect(0,0,160,160),i.fillStyle=s(n.skin),i.beginPath(),i.ellipse(80,92,58,56,0,0,Math.PI*2),i.fill(),i.fillStyle=s(n.hair),i.beginPath(),i.ellipse(80,62,60,36,0,Math.PI,Math.PI*2),i.fill(),i.beginPath(),i.ellipse(98,50,34,16,-.4,0,Math.PI*2),i.fill(),i.fillStyle=s(n.band),i.fillRect(20,58,120,10);const r=Wh(e).image;return i.drawImage(r,18,30,124,124),t.toDataURL()}const Ne={halfLength:11.885,halfWidth:4.115,doublesHalfWidth:5.485,serviceLine:6.4,netCenter:.914,netPost:1.07,postX:5.03},tn=.034,om=9.81,Vn={flat:{spin:4,bounce:.7,skid:.9,time:[1.08,.68],color:4054148,clear:.4},topspin:{spin:11,bounce:.86,skid:.84,time:[1.3,.9],color:16734780,clear:1},drop:{spin:-1,bounce:.6,skid:.5,time:[1.7,1.5],color:16743129,clear:.3},slice:{spin:-2.8,bounce:.5,skid:.72,time:[1.32,.98],color:4171007,clear:.22},lob:{spin:.8,bounce:.7,skid:.8,time:[2.25,1.85],color:16765500,clear:3.2},serve:{spin:4.5,bounce:.7,skid:.84,time:[.86,.5],color:12938239,clear:.12},stretch:{spin:1.5,bounce:.62,skid:.78,time:[1.45,1.25],color:16777215,clear:.9}},Si={rookie:{label:"Rookie",unforced:.1,pressure:.55,speed:5.4,reaction:.26,error:1.15,power:[.15,.55],aggression:.25,reach:1.45,serve:.35},pro:{label:"Pro",unforced:.05,pressure:.42,speed:6.4,reaction:.15,error:.7,power:[.35,.8],aggression:.5,reach:1.6,serve:.6},ace:{label:"Ace",unforced:.025,pressure:.3,speed:7.3,reaction:.08,error:.42,power:[.55,1],aggression:.75,reach:1.75,serve:.85}},ri={speed:7,chargeSpeed:.42,reach:1.75,sweetLateral:.85,sweetHeight:.95,maxCharge:.9},Tl=1/240;function jM(){return{p:{x:0,y:1,z:0},v:{x:0,y:0,z:0},spinAccel:0,shot:"topspin",bounces:0,spinVisual:0,netTouched:!1,held:!1}}function am(n){const e=Math.min(1,Math.abs(n)/Ne.postX);return Ne.netCenter+(Ne.netPost-Ne.netCenter)*e*e}function mr(n,e=Tl,t=[]){if(n.held)return t;const i=-(om+n.spinAccel),s=n.p,r=n.v,o=s.z,a=s.x+r.x*e,l=s.y+r.y*e+.5*i*e*e,c=s.z+r.z*e;if(r.y+=i*e,o>0!=c>0&&Math.abs(a)<Ne.postX+.2){const u=am(a);if(l<u+tn){const h=l>u-.05&&!n.netTouched;return n.netTouched=!0,h?(r.z*=.32,r.x*=.5,r.y=Math.abs(r.y)*.25+1.6,n.spinAccel=0,s.x=a,s.y=u+tn+.01,s.z=c,t.push({type:"net",cord:!0,x:a,y:u}),t):(r.z*=-.12,r.x*=.3,r.y*=.2,s.x=a,s.y=Math.max(l,tn),s.z=o>0?.06:-.06,t.push({type:"net",cord:!1,x:a,y:l}),t)}}if(l<=tn&&r.y<0){const u=Vn[n.shot]||Vn.topspin,h=Math.hypot(r.x,r.y,r.z);s.x=a,s.z=c,s.y=tn;const d=n.bounces===0;r.y=-r.y*(d?u.bounce:.55);const f=d?u.skid:.8;return r.x*=f,r.z*=f,n.spinAccel*=.25,n.bounces+=1,r.y<.4&&(r.y=0),t.push({type:"bounce",x:a,z:c,speed:h,index:n.bounces}),t}return s.x=a,s.y=l,s.z=c,s.y<=tn&&r.y===0&&(s.y=tn,r.x*=.995,r.z*=.995),t}function JM(n){return{...n,p:{...n.p},v:{...n.v}}}function lm(n,e=3,t=4){const i=JM(n);i.held=!1;const s=[],r=[],o=[];let a=0,l=0,c=null;for(;a<e;){o.length=0,mr(i,Tl,o),a+=Tl,l+=1;for(const u of o)u.type==="bounce"&&r.push({t:a,x:u.x,z:u.z}),u.type==="net"&&!c&&(c={t:a,cord:u.cord});if(l%t===0&&s.push({t:a,x:i.p.x,y:i.p.y,z:i.p.z,bounces:i.bounces}),i.bounces>=3)break}return{samples:s,bounces:r,net:c}}function KM(n,e,t,i,s=.3){const r=Vn[i]||Vn.topspin,o=om+r.spin;let a=t;for(let h=0;h<24;h++){const d=(e.x-n.x)/a,f=(e.z-n.z)/a,A=(tn-n.y+.5*o*a*a)/a;if(!(n.z>0!=e.z>0))return{v:{x:d,y:A,z:f},time:a,spinAccel:r.spin};const m=-n.z/f,p=n.x+d*m;if(n.y+A*m-.5*o*m*m>=am(p)+tn+s)return{v:{x:d,y:A,z:f},time:a,spinAccel:r.spin};a*=1.05}const l=(e.x-n.x)/a,c=(e.z-n.z)/a,u=(tn-n.y+.5*o*a*a)/a;return{v:{x:l,y:u,z:c},time:a,spinAccel:r.spin}}function ZM(n,e,t,i,s,r={}){const o=Vn[i]||Vn.topspin,a=(o.time[0]+(o.time[1]-o.time[0])*s)*(r.timeScale||1),l=KM(e,t,a,i,r.clear??o.clear);return n.p={...e},n.v=l.v,n.spinAccel=l.spinAccel,n.shot=i,n.bounces=0,n.netTouched=!1,n.held=!1,l}function $M(n,e,t){const i=tn;return Math.abs(n)>Ne.halfWidth+i?!1:t>0?e>=-i&&e<=Ne.halfLength+i:e<=i&&e>=-11.885-i}function eS(n,e,t,i){const s=tn,r=t>0?e>=-s&&e<=Ne.serviceLine+s:e<=s&&e>=-6.4-s,o=i>0?n>=-s&&n<=Ne.halfWidth+s:n<=s&&n>=-4.115-s;return r&&o}const ll=n=>n===0?1:-1,qr=n=>1-n;function cm(n=2){return{gamesToWin:n,games:[0,0],points:[0,0],server:0,faults:0,winner:null,stats:[{aces:0,winners:0,perfects:0,faults:0},{aces:0,winners:0,perfects:0,faults:0}],longestRally:0}}function um(n){return(n.points[0]+n.points[1])%2===0?"deuce":"ad"}function qh(n){const e=um(n)==="deuce",t=n.server===0?1:-1;return e?t:-t}function hm(n){return-qh(n)}function Xh(n){const[e,t]=n.points;if(e>=3&&t>=3)return e===t?{kind:"deuce",text:"DEUCE"}:{kind:"advantage",leader:e>t?0:1,text:"ADVANTAGE"};const i=["LOVE","15","30","40"];if(e===t)return{kind:"all",text:e===0?"LOVE ALL":`${i[e]} ALL`};const s=n.server;return{kind:"score",text:`${i[n.points[s]]}–${i[n.points[qr(s)]]}`}}function tS(n,e){n.points[e]+=1,n.faults=0;const[t,i]=n.points,s=Math.abs(t-i);if(Math.max(t,i)>=4&&s>=2){const o=t>i?0:1;return n.games[o]+=1,n.points=[0,0],n.server=qr(n.server),n.games[o]>=n.gamesToWin?(n.winner=o,{game:!0,match:!0,gameWinner:o}):{game:!0,match:!1,gameWinner:o}}return{game:!1,match:!1,gameWinner:null}}function nS(n){return{server:n.server,boxSign:hm(n),serving:!0,lastHitter:null,bouncesSinceHit:0,hits:0,verdict:null}}function dm(n,e){return n.verdict?n.verdict:n.serving&&n.lastHitter!==null&&e!==n.lastHitter&&n.bouncesSinceHit===0?(n.verdict={winner:n.lastHitter,reason:"volley-serve"},n.verdict):(n.lastHitter!==null&&n.lastHitter!==e&&(n.serving=!1),n.lastHitter=e,n.bouncesSinceHit=0,n.hits+=1,null)}function iS(n,e,t){if(n.verdict||n.lastHitter===null)return n.verdict;const i=n.lastHitter,s=qr(i);return n.bouncesSinceHit+=1,n.bouncesSinceHit===1?(ll(s)>0?t>0:t<0)?((n.serving?eS(e,t,ll(s),n.boxSign):$M(e,t,ll(s)))||(n.verdict={winner:s,reason:n.serving?"fault":"out"}),n.verdict):(n.verdict={winner:s,reason:n.serving?"fault-net":"net"},n.verdict):(n.verdict={winner:i,reason:n.serving?"ace":"winner"},n.verdict)}function Gf(n){if(n.verdict||n.lastHitter===null)return n.verdict;const e=n.lastHitter;return n.bouncesSinceHit>=1?n.verdict={winner:e,reason:n.serving?"ace":"winner"}:n.verdict={winner:qr(e),reason:n.serving?"fault":"out"},n.verdict}function sS(n){return n&&(n.reason==="fault"||n.reason==="fault-net")}const Nr={x:Ne.doublesHalfWidth+6.5,z:Ne.halfLength+7};function zf(n){const e=ll(n);return{who:n,side:e,dir:-e,right:e,x:0,z:e*(Ne.halfLength+.6),vx:0,vz:0,speed:0,state:"ready",stateTime:0,pending:null,charge:0,swing:null,plan:null,aim:{x:0,y:0},look:{x:0,z:0},emotion:0}}function rS(n,e,t){return{lateral:(e-n.x)*n.right,forward:(t-n.z)*n.dir}}function Yh(n,e){return e.v.z*n.dir<-.5}function fm(n,e,t,i={}){const{speed:s=ri.speed,allowVolley:r=!0,mustBounce:o=!1}=i;let a=null,l=1/0;for(const c of t.samples){if(!(n.side>0?c.z>.6:c.z<-.6))continue;if(c.bounces>=2)break;if(o&&c.bounces<1||!r&&c.bounces<1||c.y<.32||c.y>2.1||Math.abs(c.x)>Nr.x-1||Math.abs(c.z)>Nr.z-.5)continue;const d=(c.x-n.x)*n.right>=-.15?1:-1,f=c.x-d*n.right*ri.sweetLateral,A=c.z-n.dir*.25,m=Math.hypot(f-n.x,A-n.z)/s,p=c.t-m,E=Math.abs(c.y-1)*.6,v=c.bounces<1?.25:0,x=(p<0?4+-p*8:0)+E+v+c.t*.15;x<l&&(l=x,a={t:c.t,x:c.x,y:c.y,z:c.z,standX:f,standZ:A,hand:d,slack:p,bounced:c.bounces>=1})}return a}function qc(n,e,t=ri.reach){if(!Yh(n,e))return null;const{lateral:i,forward:s}=rS(n,e.p.x,e.p.z),r=e.p.y;if(r<.1||r>2.7||s>.55||s<-.7)return null;const o=Math.abs(i);if(o>t)return null;const a=1-Math.min(1,Math.abs(o-ri.sweetLateral)/.9),l=1-Math.min(1,Math.abs(r-ri.sweetHeight)/1.2),c=1-Math.min(1,Math.abs(s-.15)/.7),u=Math.max(0,a*.45+l*.3+c*.25),h=o>t-.3||r<.25,d=r>1.85?"smash":i>=-.1?"forehand":"backhand";return{lateral:i,forward:s,height:r,sweet:u,stretch:h,kind:d}}function ps(n,e,t,i,s){const o=e*i,a=t*i,l=o-n.vx,c=a-n.vz,u=Math.hypot(l,c),h=38*s;u<=h?(n.vx=o,n.vz=a):(n.vx+=l/u*h,n.vz+=c/u*h),n.x+=n.vx*s,n.z+=n.vz*s;const d=n.side>0?.7:-18.884999999999998,f=n.side>0?Nr.z:-.7;n.x=Math.max(-11.985,Math.min(Nr.x,n.x)),n.z=Math.max(d,Math.min(f,n.z)),n.speed=Math.hypot(n.vx,n.vz)}function Rl(n,e,t,i){const s=e-n.x,r=t-n.z,o=Math.hypot(s,r);if(o<.03)return{x:0,z:0};const a=Math.min(1,o/Math.max(.35,i*.09));return{x:s/o*a,z:r/o*a}}function Vf(n,e){return{d:n,rng:e,seenHit:-1,reactAt:0,plan:null,nextShot:null,homeX:0,netRush:!1}}function oS(n,e,t){const{d:i,rng:s}=n,r=Math.abs(t.z)<5.5;let o="topspin";const a=s();r&&a<.4?o="lob":a<.15?o="slice":!r&&a<.22?o="drop":a<.6&&(o="flat");const l=t.x*e.right/Ne.halfWidth;let c=-Math.sign(l||s()-.5)*(.45+s()*.55*i.aggression+.2);s()<.3-i.aggression*.2&&(c=(s()-.5)*.6);const u=s()<.15*i.aggression?-1:s()*.6,h=i.power[0]+(i.power[1]-i.power[0])*s();return{shot:o,aim:{x:Math.max(-1,Math.min(1,c)),y:u},power:h}}function Wf(n,e,t,i,s,r,o,a){const l=n.d;s!==n.seenHit&&(n.seenHit=s,n.reactAt=r+l.reaction*(.7+n.rng()*.6),n.plan=null,n.nextShot=null);const c=Yh(e,i);if(c&&r>=n.reactAt&&(!n.plan||n.replanAt<=r)){const h=lm(i,3.2,3),d=Math.abs(e.z)<6.5,f=fm(e,i,h,{speed:l.speed,allowVolley:d||i.bounces>0,mustBounce:n.mustBounce});if(f){const A=(n.rng()-.5)*l.error*.35;f.standX+=A,n.plan=f,n.nextShot=oS(n,e,t)}n.replanAt=r+.25}let u={x:0,z:0};if(c&&n.plan)u=Rl(e,n.plan.standX,n.plan.standZ,l.speed);else if(!c){const h=e.side*(n.netRush?4.5:Ne.halfLength-.2),d=Math.max(-1.6,Math.min(1.6,t.x*.35));u=Rl(e,d,h,l.speed*.8)}return ps(e,u.x,u.z,l.speed,o),{wantSwing:c&&!!n.plan}}function $o(n){let e=0,t=0;for(;e===0;)e=n();for(;t===0;)t=n();return Math.sqrt(-2*Math.log(e))*Math.cos(2*Math.PI*t)}function Or(n){return n>=.86?"perfect":n>=.62?"great":n>=.35?"nice":"weak"}function pm(n,e,t,i,s,r){const o=-n.side,a=2.4+i*1.3+(s>=.86?.35:0);let l=t.x;Math.abs(t.x)<.2&&(l=Math.max(-.55,Math.min(.55,-n.x*n.right/6)));let c=n.right*l*a,u;e==="lob"?u=9.6+t.y*1.4:e==="drop"?u=2.4+Math.max(0,t.y)*.8:e==="topspin"?u=t.y<-.3?5:9.3+t.y*1.5+i*.5:e==="slice"?u=t.y<-.3?4.2:8.2+t.y*2:u=t.y<-.3?5.6:8.9+t.y*1.8+i*.6;const h=Or(s),d=h==="perfect"?.12:(1-s)*(.9+i*1.1);return c+=$o(r)*d,u+=$o(r)*d*1.15,h==="perfect"&&(c=Math.max(-4.115+.3,Math.min(Ne.halfWidth-.3,c)),u=Math.max(2.5,Math.min(Ne.halfLength-.35,u))),{x:c,y:tn,z:o*u}}function aS(n,e,t,i,s){const r=-n.side,o=Math.max(-1,Math.min(1,t.x*n.right*e));let a=e*(2.05+o*1.6),l=Ne.serviceLine-.75;const c=Or(i),u=c==="perfect"?.08:(1-i)*1.15;return a+=$o(s)*u,l+=Math.abs($o(s))*u*1.1-u*.25,c==="perfect"&&(a=e*Math.max(.35,Math.min(Ne.halfWidth-.3,Math.abs(a))),l=Math.min(Ne.serviceLine-.3,l)),{x:a,y:tn,z:r*l}}function Am(n,e,t,i,s,r){return ZM(n,e,t,i,s,r)}function lS(n,e,t,i){const s=-e.side;return t==="long"?n.z=s*(Ne.halfLength+.4+i()*1.3):t==="wide"&&(n.x=(Math.sign(n.x)||(i()<.5?-1:1))*(Ne.halfWidth+.35+i()*1.2)),n}Object.fromEntries(Object.entries(Vn).map(([n,e])=>[n,e.color]));const mm=5.6,cS=1.35;function uS(n){let e=n>>>0;return()=>{e=e+1831565813>>>0;let t=e;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}}function jh(n){return Math.max(0,1-Math.abs(n-vm)/hS)}const hS=.34;function Jh({difficulty:n="pro",games:e=2,seed:t=Date.now(),autoHuman:i=!1}={}){const s=uS(t),r={rng:s,time:0,freeze:0,match:cm(e),difficulty:Si[n]||Si.pro,ball:jM(),athletes:[zf(0),zf(1)],brain:null,autoBrain:null,rally:null,phase:"idle",phaseTime:0,hitCount:0,rallyHits:0,events:[],pendingVerdict:null,ballVisible:!1,stillTime:0,plan:null,planAt:0,landing:null,tossAt:0,cpuTossAt:0,serveAim:0};return r.brain=Vf(r.difficulty,s),i&&(r.autoBrain=Vf(Si.pro,s)),r}function bn(n,e,t={}){n.events.push({type:e,t:n.time,...t})}function Gi(n,e){n.phase=e,n.phaseTime=0}function gm(n){n.match=cm(n.match.gamesToWin),Bl(n)}function Bl(n){const e=n.match;n.rally=nS(e),n.rallyHits=0,n.pendingVerdict=null,n.landing=null,n.ballVisible=!0,n.stillTime=0;const t=n.athletes[e.server],i=n.athletes[qr(e.server)],s=qh(e);t.x=s*.9,t.z=t.side*(Ne.halfLength+.35),i.x=-s*2.3,i.z=i.side*(Ne.halfLength+.4);for(const r of n.athletes)r.vx=r.vz=r.speed=0,r.state="ready",r.pending=null,r.charge=0,r.swing=null,r.stateTime=0;sh(n),n.cpuTossAt=0,Gi(n,"setup"),bn(n,"setup",{server:e.server,side:um(e),second:e.faults>0,label:Xh(e)})}function sh(n){const e=n.athletes[n.match.server],t=n.ball;t.held=!0,t.v={x:0,y:0,z:0},t.p={x:e.x-e.right*.28,y:1,z:e.z+e.dir*.25},t.bounces=0,t.spinAccel=0,t.shot="serve"}function _m(n){const e=n.athletes[n.match.server],t=n.ball;t.held=!1,t.p={x:e.x+e.right*.12,y:cS,z:e.z+e.dir*.32},t.v={x:0,y:mm,z:0},t.spinAccel=0,t.bounces=0,t.netTouched=!1,n.tossAt=n.time,e.state="toss",e.stateTime=0,Gi(n,"toss"),bn(n,"toss",{who:e.who})}const vm=mm/9.81;function xm(n,e,t,i,s){const r=n.match,o=n.athletes[r.server],a=n.ball,l=aS(o,hm(r),{x:i},t,n.rng),c={...a.p},u=e==="slice"?"slice":"serve";Am(a,c,l,u,u==="slice"?.55+s*.45:s),o.state="swing",o.stateTime=0,o.swing={kind:"serve",shot:u,t:0,grade:Or(t)},n.hitCount+=1,dm(n.rally,o.who);const h=Or(t);h==="perfect"&&(r.stats[o.who].perfects+=1,n.freeze=.085),Gi(n,"rally"),bn(n,"hit",{who:o.who,shot:u,grade:h,power:s,serve:!0,x:c.x,y:c.y,z:c.z,target:l})}function dS(n,e){const t=n.lastShot||{grade:"nice",power:.4};return(t.grade==="perfect"?.35:t.grade==="great"?.15:0)+t.power*.15+(e.stretch?.3:0)+(1-e.sweet)*.2}function Xc(n,e,t,i,s,r,o=null){const a=n.ball;let l=i,c=s,u=r;t.stretch&&(l=i==="lob"?"lob":"stretch",c=Math.min(c,.35),u=Math.min(u,.55)),t.kind==="smash"&&l!=="lob"&&(l="topspin",c=Math.max(c,.9));const h=e.who===0?n.humanAim:e.aim,d=pm(e,l,h,c,u,n.rng),f={x:a.p.x,y:Math.max(a.p.y,.25),z:a.p.z},A=Or(u),g={timeScale:A==="perfect"?.86:1};o==="net"?(g.clear=-.45,g.timeScale=.8):o&&lS(d,e,o,n.rng),Am(a,f,d,l,c,g),n.lastShot={grade:A,power:c,shot:l};const m=dm(n.rally,e.who);n.hitCount+=1,n.rallyHits+=1;const p=Or(u);e.state="swing",e.stateTime=0,e.swing={kind:t.kind,shot:l,t:0,grade:p,stretch:t.stretch},e.pending=null,e.charge=0,p==="perfect"&&(n.match.stats[e.who].perfects+=1,n.freeze=t.kind==="smash"?.12:.085),bn(n,"hit",{who:e.who,shot:l,grade:p,power:c,kind:t.kind,stretch:t.stretch,x:f.x,y:f.y,z:f.z,target:d}),m&&cl(n,m)}function qf(n,e,t){const i=e.unforced+dS(n,t)*e.pressure;if(n.rng()>=i)return null;const r=n.rng();return r<.45?"long":r<.8?"wide":"net"}function cl(n,e){if(n.pendingVerdict)return;n.pendingVerdict=e,Gi(n,"dead");const t=n.match;n.rally.serving&&n.ball.netTouched&&e.reason==="ace"&&n.rally.hits===1&&(e.reason="let"),bn(n,"verdict",{...e,rallyHits:n.rallyHits,faults:t.faults})}function fS(n){const e=n.match,t=n.pendingVerdict;if(n.pendingVerdict=null,t.reason==="let"){Bl(n);return}if(sS({reason:t.reason})){if(e.stats[e.server].faults+=1,e.faults===0){e.faults=1,Bl(n);return}t.reason="double-fault"}t.reason==="ace"&&(e.stats[t.winner].aces+=1),t.reason==="winner"&&(e.stats[t.winner].winners+=1),e.longestRally=Math.max(e.longestRally,n.rallyHits);const i=tS(e,t.winner);if(bn(n,"point",{winner:t.winner,reason:t.reason,...i,label:Xh(e),games:[...e.games]}),i.match){Gi(n,"over");for(const s of n.athletes)s.state=s.who===i.gameWinner?"celebrate":"sad",s.stateTime=0;bn(n,"match",{winner:i.gameWinner});return}n.betweenPoints=i.game?2.1:1.15;for(const s of n.athletes)s.state=s.who===t.winner?"celebrate":"sad",s.stateTime=0;Gi(n,"between")}function pS(n,e,t){const i=n.athletes[0],s=n.ball,r=n.phase==="rally"&&Yh(i,s)&&n.rally.lastHitter===1;if(r&&n.time>=n.planAt){const h=lm(s,3,3);n.plan=fm(i,s,h,{speed:ri.speed,allowVolley:!0,mustBounce:n.rally.serving}),n.planAt=n.time+.12;const d=h.bounces[0];n.landing=d&&d.z>0?{x:d.x,z:d.z,t:n.time+d.t}:n.landing}r||(n.plan=null);const o=!!i.pending,a=ri.speed*(o?ri.chargeSpeed+.2:1);let l=e.move.x,c=e.move.z;const u=n.plan;if(u&&r){const h=Math.hypot(u.standX-i.x,u.standZ-i.z),d=Rl(i,u.standX,u.standZ,a),f=Math.hypot(l,c)>.15;let A=o?f?.55:.92:f?.12:.35;h>3.2&&(A*=.4),l=l*(1-A)+d.x*A,c=c*(1-A)+d.z*A}ps(i,l,c,a,t)}function AS(n,e){n.pending&&(n.charge=Math.min(1,(e-n.pending.at)/ri.maxCharge))}function Yc(n,e,t){if(n.events.length=0,n.freeze>0)return n.freeze-=t,n.events;const i=Math.max(1,Math.round(t/Tl)),s=t/i;mS(n,e),gS(n,e);for(let r=0;r<i;r++)_S(n,e,s);return n.events}function mS(n,e){const t=e.press;if(n.autoBrain||!t)return;const i=n.match,s=n.athletes[0];if(n.phase==="serve"&&i.server===0){n.humanServeShot=t,_m(n);return}if(n.phase==="toss"&&i.server===0){Em(n,t,e.aim.x);return}if(n.phase==="rally"||n.phase==="between"||n.phase==="setup"){if(n.phase!=="rally"||s.state==="swing"&&s.stateTime<.25)return;s.pending?s.pending.shot!==t&&(s.pending.shot=t,bn(n,"charge",{who:0,shot:t,change:!0})):(s.pending={shot:t,at:n.time},s.state="charge",s.stateTime=0,bn(n,"charge",{who:0,shot:t}))}}function gS(n,e){!e.release||n.autoBrain||n.phase!=="toss"||n.match.server!==0||Em(n,n.humanServeShot,e.aim.x)}function Em(n,e,t){if(n.ball.p.y<1.45)return;const i=n.time-n.tossAt,s=jh(i);n.serveGauge=s,xm(n,e,s,t,.35+s*.65)}function _S(n,e,t){n.time+=t,n.phaseTime+=t;const[i,s]=n.athletes,r=n.ball,o=n.match;for(const a of n.athletes)a.stateTime+=t,a.swing&&(a.swing.t+=t,a.swing.t>.55&&(a.swing=null,a.state==="swing"&&(a.state="ready"))),AS(a,n.time),a.look.x=r.p.x,a.look.z=r.p.z;switch(n.humanAim=e.aim,n.phase){case"setup":n.phaseTime>.75&&Gi(n,"serve"),sh(n);break;case"serve":{const a=n.athletes[o.server];if(o.server===0&&!n.autoBrain){const l=qh(o);ps(i,e.move.x,0,3.2,t);const c=.15,u=3.2,h=Math.abs(i.x);(Math.sign(i.x)!==l||h<c)&&(i.x=l*c),h>u&&(i.x=l*u),i.z=i.side*(Ne.halfLength+.35)}else n.cpuTossAt||(n.cpuTossAt=n.time+.7+n.rng()*.6),n.time>=n.cpuTossAt&&_m(n);n.phase==="serve"&&sh(n),Xf(n,a===i?s:i,t);break}case"toss":{const a=n.athletes[o.server];mr(r,t);const l=n.time-n.tossAt;if(o.server===1||n.autoBrain){const u=o.server===1?n.brain:n.autoBrain;if(!n.cpuServeAt){const h=u.d.serve;n.cpuServeAt=n.tossAt+vm+$o(n.rng)*(1-h)*.16,n.cpuServeAim=(n.rng()-.5)*2,n.cpuServeShot=n.rng()<.25?"slice":"serve"}if(n.time>=n.cpuServeAt&&r.p.y>1.45){const h=jh(l),d=(.3+h*.6)*(.75+u.d.serve*.25);n.cpuServeAt=0,xm(n,n.cpuServeShot,h,n.cpuServeAim,d)}}n.phase==="toss"&&r.v.y<0&&r.p.y<1.15&&(n.cpuServeAt=0,a.state="ready",Gi(n,"serve"),n.cpuTossAt=n.time+.5,bn(n,"retoss",{who:a.who})),Xf(n,n.athletes[qr(o.server)],t);break}case"rally":vS(n,e,t);break;case"dead":mr(r,t);for(const a of n.athletes)a.pending=null,ps(a,0,0,6,t);n.phaseTime>1.25&&fS(n);break;case"between":mr(r,t);for(const a of n.athletes)ps(a,0,0,6,t);n.phaseTime>n.betweenPoints&&Bl(n);break;case"over":mr(r,t);for(const a of n.athletes)ps(a,0,0,6,t);break}}function Xf(n,e,t){const i={x:e.x,z:e.z},s=Rl(e,i.x,i.z,3);ps(e,s.x,s.z,3,t)}function vS(n,e,t){const[i,s]=n.athletes,r=n.ball,o=[];mr(r,t,o);for(const h of o)if(h.type==="bounce"){const d=iS(n.rally,h.x,h.z);if(bn(n,"bounce",{x:h.x,z:h.z,speed:h.speed,index:h.index,out:!!d&&(d.reason==="out"||d.reason==="fault")}),d){cl(n,d);return}}else h.type==="net"&&bn(n,"net",{cord:h.cord,x:h.x,y:h.y});if(Math.abs(r.p.x)>Nr.x+4||Math.abs(r.p.z)>Nr.z+6){const h=Gf(n.rally);if(h)return cl(n,h)}const a=Math.hypot(r.v.x,r.v.y,r.v.z)<.4;if(n.stillTime=a?n.stillTime+t:0,n.stillTime>.4){const h=Gf(n.rally);if(h)return cl(n,h)}const l=n.rally.lastHitter===0&&!(n.rally.serving&&r.bounces===0);if(n.brain.mustBounce=n.rally.serving,n.autoBrain&&(n.autoBrain.mustBounce=n.rally.serving),Wf(n.brain,s,i,r,n.hitCount,n.time,t).wantSwing&&l){const h=qc(s,r,n.difficulty.reach);if(h){const d=n.brain.nextShot||{shot:"topspin",aim:{x:0,y:0},power:.5};s.aim=d.aim;const f=1-n.difficulty.error/1.4,A=Math.max(0,Math.min(1,h.sweet*.5+f*.45+(n.rng()-.5)*.3));if(Xc(n,s,h,d.shot,d.power,A,qf(n,n.difficulty,h)),n.phase!=="rally")return}}const u=n.rally.lastHitter===1&&!(n.rally.serving&&r.bounces===0);if(n.autoBrain){if(Wf(n.autoBrain,i,s,r,n.hitCount,n.time,t).wantSwing&&u){const d=qc(i,r,Si.pro.reach);if(d){const f=n.autoBrain.nextShot||{shot:"topspin",aim:{x:0,y:0},power:.5};i.aim=f.aim,n.humanAim=f.aim;const A=Math.max(0,Math.min(1,d.sweet*.5+.4+(n.rng()-.5)*.3));Xc(n,i,d,f.shot,f.power,A,qf(n,Si.pro,d))}}return}if(pS(n,e,t),i.pending&&u){const h=qc(i,r,ri.reach);if(h){const d=Math.max(0,Math.min(1,h.sweet*.5+i.charge*.5)),f=.2+i.charge*.8;Xc(n,i,h,i.pending.shot,f,d);return}}if(i.pending&&u&&(r.p.z-i.z)*i.dir<-1&&r.p.y<2.5){i.pending=null,i.charge=0,i.state="swing",i.stateTime=0;const d=(r.p.x-i.x)*i.right;i.swing={kind:d>=0?"forehand":"backhand",shot:"topspin",t:0,grade:"miss"},bn(n,"whiff",{who:0})}}const cs=900;function xS(){const n=new mt,e=new Float32Array(cs*3),t=new Float32Array(cs*4),i=new Float32Array(cs),s=new Float32Array(cs);n.setAttribute("position",new it(e,3).setUsage(fs)),n.setAttribute("color",new it(t,4).setUsage(fs)),n.setAttribute("size",new it(i,1).setUsage(fs)),n.setAttribute("shape",new it(s,1).setUsage(fs));const r=new Mn({transparent:!0,depthWrite:!1,uniforms:{scale:{value:600}},vertexShader:`
      attribute float size; attribute vec4 color; attribute float shape;
      uniform float scale;
      varying vec4 vColor; varying float vShape;
      void main() {
        vColor = color; vShape = shape;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = min(size * scale / -mv.z, 64.0);
        gl_Position = projectionMatrix * mv;
      }`,fragmentShader:`
      varying vec4 vColor; varying float vShape;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float a;
        if (vShape > 1.5) {
          // Four-point sparkle.
          float d = min(abs(p.x), abs(p.y)) * 4.0 + length(p) * 0.9;
          a = 1.0 - smoothstep(0.55, 1.0, d);
        } else if (vShape > 0.5) {
          // Five-point star.
          float ang = atan(p.y, p.x);
          float r = length(p);
          float k = 0.55 + 0.45 * pow(abs(cos(2.5 * ang)), 2.0);
          a = 1.0 - smoothstep(k * 0.85, k, r);
        } else {
          float r = length(p);
          a = 1.0 - smoothstep(0.6, 1.0, r);
        }
        if (a * vColor.a < 0.01) discard;
        gl_FragColor = vec4(vColor.rgb, a * vColor.a);
      }`}),o=new UA(n,r);o.frustumCulled=!1,o.renderOrder=5;const a=[];for(let l=0;l<cs;l++)a.push({life:0});return{points:o,list:a,cursor:0,geo:n}}function ES(){const e=new mt;e.setAttribute("position",new it(new Float32Array(156),3).setUsage(fs)),e.setAttribute("alpha",new it(new Float32Array(52),1).setUsage(fs));const t=[];for(let r=0;r<25;r++){const o=r*2;t.push(o,o+1,o+2,o+1,o+3,o+2)}e.setIndex(t);const i=new Mn({transparent:!0,depthWrite:!1,blending:Fo,side:nn,uniforms:{color:{value:new ye(16734780)},strength:{value:1}},vertexShader:`
      attribute float alpha; varying float vA;
      void main() { vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:`
      uniform vec3 color; uniform float strength; varying float vA;
      void main() { gl_FragColor = vec4(color * strength, vA); }`}),s=new Me(e,i);return s.frustumCulled=!1,s.renderOrder=4,{mesh:s,N:26,pts:[],width:.09}}function jc(n=0,e=!1){const t=document.createElement("canvas");t.width=t.height=128;const i=t.getContext("2d"),s=i.createRadialGradient(64,64,n,64,64,64);return e?(i.strokeStyle="#fff",i.lineWidth=12,i.beginPath(),i.arc(64,64,52,0,Math.PI*2),i.stroke(),i.fillStyle="rgba(255,255,255,0.25)",i.beginPath(),i.arc(64,64,46,0,Math.PI*2),i.fill()):(s.addColorStop(0,"rgba(0,0,0,1)"),s.addColorStop(.6,"rgba(0,0,0,0.6)"),s.addColorStop(1,"rgba(0,0,0,0)"),i.fillStyle=s,i.fillRect(0,0,128,128)),new Gr(t)}function bS(){const n=document.createElement("canvas");n.width=n.height=64;const e=n.getContext("2d"),t=e.createRadialGradient(32,32,4,32,32,32);return t.addColorStop(0,"rgba(255,255,255,0.9)"),t.addColorStop(.35,"rgba(255,255,255,0.35)"),t.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=t,e.fillRect(0,0,64,64),new Gr(n)}function yS(){const n=document.createElement("canvas");n.width=256,n.height=128;const e=n.getContext("2d");e.fillStyle="#e4ff3a",e.fillRect(0,0,256,128),e.strokeStyle="#ffffff",e.lineWidth=9,e.beginPath();for(let i=0;i<=256;i+=4){const s=64+Math.sin(i/256*Math.PI*4)*34;i===0?e.moveTo(i,s):e.lineTo(i,s)}e.stroke();const t=new Gr(n);return t.colorSpace=Bt,t}function MS(n){const e={scene:n,time:0};e.particles=xS(),n.add(e.particles.points),e.trail=ES(),n.add(e.trail.mesh);const t=new Me(new Xt(tn*2.3,20,14),new Oh({map:yS(),emissive:3820032}));t.castShadow=!0,n.add(t),e.ball=t;const i=new Me(new Xt(tn*2.75,16,12),new dn({color:1907246,side:Yt}));t.add(i);const s=new S_(new RA({map:bS(),color:16056218,transparent:!0,depthWrite:!1,blending:Fo,opacity:.55}));s.scale.set(.42,.42,1),t.add(s);const r=new Me(new En(1,1),new dn({map:jc(),transparent:!0,depthWrite:!1,opacity:.5}));r.rotation.x=-Math.PI/2,r.renderOrder=2,n.add(r),e.shadow=r;const o=jc(0,!0),a=new Me(new En(1,1),new dn({map:o,transparent:!0,depthWrite:!1,color:16769357}));a.rotation.x=-Math.PI/2,a.position.y=.012,a.renderOrder=3,a.visible=!1,n.add(a),e.marker=a;const l=a.clone();l.material=a.material.clone(),l.material.color.set(16777215),l.material.opacity=.85,l.visible=!1,n.add(l),e.aim=l,e.marks=[];for(let c=0;c<10;c++){const u=new Me(new En(1,1),new dn({map:jc(),transparent:!0,depthWrite:!1,opacity:0,color:16777215}));u.rotation.x=-Math.PI/2,u.position.y=.008,u.renderOrder=2,u.userData.life=0,n.add(u),e.marks.push(u)}e.markCursor=0,e.rings=[];for(let c=0;c<8;c++){const u=new Me(new En(1,1),new dn({map:o,transparent:!0,depthWrite:!1,blending:Fo}));u.visible=!1,u.userData={life:0,max:.3,size:1,flat:!1},u.renderOrder=6,n.add(u),e.rings.push(u)}return e.ringCursor=0,e}const Wa=new ye;function jl(n,e){const t=n.particles,i=t.list[t.cursor];t.cursor=(t.cursor+1)%cs,Object.assign(i,{x:e.x,y:e.y,z:e.z,vx:e.vx||0,vy:e.vy||0,vz:e.vz||0,life:e.life||.6,max:e.life||.6,size:e.size||.2,grow:e.grow??-.5,g:e.gravity??0,drag:e.drag??2,color:e.color??16777215,shape:e.shape||0,alpha:e.alpha??1,spin:e.spin||0})}function SS(n,e,t,i=!1){const s=i?34:16;for(let r=0;r<s;r++){const o=Math.random()*Math.PI*2,a=(Math.random()-.5)*Math.PI,l=(i?6:4)*(.4+Math.random());jl(n,{x:e.x,y:e.y,z:e.z,vx:Math.cos(o)*Math.cos(a)*l,vy:Math.sin(a)*l+1,vz:Math.sin(o)*Math.cos(a)*l,life:.35+Math.random()*.35,size:(i?.28:.2)*(.6+Math.random()),color:r%3===0?16777215:t,shape:r%2?1:2,drag:5,gravity:-4})}Ll(n,e,t,i?2.6:1.4,i?.32:.22,!1),i&&Ll(n,e,16777215,4.2,.4,!1)}function wS(n,e,t,i=1,s=14083327){const r=Math.round(6+i*8);for(let o=0;o<r;o++){const a=o/r*Math.PI*2+Math.random()*.4,l=.8+Math.random()*1.4*i;jl(n,{x:e,y:.05,z:t,vx:Math.cos(a)*l,vy:.4+Math.random()*.8,vz:Math.sin(a)*l,life:.45+Math.random()*.3,size:.18+Math.random()*.14,grow:.9,color:s,alpha:.7,drag:4,gravity:-.5})}}function Ll(n,e,t,i,s,r){const o=n.rings[n.ringCursor];n.ringCursor=(n.ringCursor+1)%n.rings.length,o.visible=!0,o.position.copy(e),o.material.color.setHex(t),o.userData={life:s,max:s,size:i,flat:r},o.rotation.set(r?-Math.PI/2:0,0,0)}function CS(n,e,t,i){const s=n.marks[n.markCursor];n.markCursor=(n.markCursor+1)%n.marks.length,s.position.set(e,.008+n.markCursor*3e-4,t),s.scale.set(.22,.34,1),s.material.color.setHex(i?16731486:858688),s.userData.life=i?3:1.6,s.userData.max=s.userData.life}function IS(n,e,t=160){const i=[16731486,4029439,16765500,2871678,16747224,16777215];for(let s=0;s<t;s++)jl(n,{x:e.x+(Math.random()-.5)*8,y:e.y+Math.random()*3,z:e.z+(Math.random()-.5)*6,vx:(Math.random()-.5)*6,vy:4+Math.random()*7,vz:(Math.random()-.5)*6,life:2.2+Math.random()*1.5,size:.2+Math.random()*.12,grow:0,color:i[s%i.length],shape:s%3===0?1:0,drag:1.2,gravity:-5})}function TS(n,e,t,i){n.trail.mesh.material.uniforms.color.value.setHex(e),n.trail.mesh.material.uniforms.strength.value=t,n.trail.width=i}function ra(n){n.trail.pts.length=0}const Yf=new w,jf=new w,Ki=new w;function RS(n,e,t,i,s){n.time+=e;const r=n.particles,o=r.geo.attributes.position.array,a=r.geo.attributes.color.array,l=r.geo.attributes.size.array,c=r.geo.attributes.shape.array;for(let f=0;f<cs;f++){const A=r.list[f];if(A.life>0){A.life-=e;const g=Math.exp(-A.drag*e);A.vx*=g,A.vy=A.vy*g+A.g*e,A.vz*=g,A.x+=A.vx*e,A.y+=A.vy*e,A.z+=A.vz*e,A.y<.02&&(A.y=.02,A.vy=Math.abs(A.vy)*.3);const m=Math.max(0,A.life/A.max);o[f*3]=A.x,o[f*3+1]=A.y,o[f*3+2]=A.z,Wa.setHex(A.color),a[f*4]=Wa.r,a[f*4+1]=Wa.g,a[f*4+2]=Wa.b,a[f*4+3]=A.alpha*Math.min(1,m*3),l[f]=Math.max(0,A.size*(1+A.grow*(1-m))),c[f]=A.shape}else l[f]=0,a[f*4+3]=0}if(r.geo.attributes.position.needsUpdate=!0,r.geo.attributes.color.needsUpdate=!0,r.geo.attributes.size.needsUpdate=!0,r.geo.attributes.shape.needsUpdate=!0,r.points.material.uniforms.scale.value=window.innerHeight/(2*Math.tan(t.fov*Math.PI/360)),n.ball.visible=s,n.shadow.visible=s,s){n.ball.position.set(i.x,i.y,i.z);const f=i.y,A=.16+Math.min(.25,f*.04);n.shadow.scale.set(A,A,1),n.shadow.position.set(i.x,.01,i.z),n.shadow.material.opacity=Math.max(.12,.55-f*.08)}const u=n.trail;s?(u.pts.unshift(new w(i.x,i.y,i.z)),u.pts.length>u.N&&u.pts.pop()):u.pts.length=0;const h=u.mesh.geometry.attributes.position.array,d=u.mesh.geometry.attributes.alpha.array;for(let f=0;f<u.N;f++){const A=u.pts[Math.min(f,u.pts.length-1)];if(!A){d[f*2]=d[f*2+1]=0;continue}const g=u.pts[Math.min(f+1,u.pts.length-1)],m=u.pts[Math.max(Math.min(f,u.pts.length-1)-1,0)];Yf.copy(m).sub(g),jf.copy(A).sub(t.position),Ki.crossVectors(Yf,jf).normalize();const p=1-f/(u.N-1),E=u.width*p;h[f*6]=A.x+Ki.x*E,h[f*6+1]=A.y+Ki.y*E,h[f*6+2]=A.z+Ki.z*E,h[f*6+3]=A.x-Ki.x*E,h[f*6+4]=A.y-Ki.y*E,h[f*6+5]=A.z-Ki.z*E;const v=f<u.pts.length?1:0;d[f*2]=d[f*2+1]=v*p*p*.9}u.mesh.geometry.attributes.position.needsUpdate=!0,u.mesh.geometry.attributes.alpha.needsUpdate=!0;for(const f of n.marks)f.userData.life>0?(f.userData.life-=e,f.material.opacity=Math.min(.55,f.userData.life/f.userData.max*.9)):f.material.opacity=0;for(const f of n.rings){if(!f.visible)continue;if(f.userData.life-=e,f.userData.life<=0){f.visible=!1;continue}const A=1-f.userData.life/f.userData.max,g=f.position.distanceTo(t.position),m=f.userData.size*Math.min(1.4,Math.max(.35,g/16))*(.2+.8*(1-Math.pow(1-A,3)));f.scale.set(m,m,m),f.material.opacity=(1-A)*.8,f.userData.flat||f.quaternion.copy(t.quaternion)}}const BS={name:"You",pfp:"",avatarUrl:""},Jc=new Set(["settings","muted"]),Jf=64*1024;function LS(n){if(!n||typeof n.id!="string"||!Array.isArray(n.members))return null;const e=n.members.slice(0,7).filter(t=>t&&typeof t.id=="string"&&t.id).map(t=>({id:t.id.slice(0,64),name:typeof t.name=="string"&&t.name.trim()?t.name.trim().slice(0,24):"Player"}));return e.length?{id:n.id.slice(0,96),size:e.length+1,members:e}:null}function DS(n){const e=i=>i&&[i.x,i.y,i.z].every(s=>typeof s=="number"&&Number.isFinite(s)&&Math.abs(s)<=1e3);if(!n||!e(n.cameraOffset)||!e(n.cameraTargetOffset)||!Number.isFinite(n.avatarRotation)||!(n.fov>5&&n.fov<150))return null;const t=i=>({x:i.x,y:i.y,z:i.z});return{cameraOffset:t(n.cameraOffset),cameraTargetOffset:t(n.cameraTargetOffset),avatarRotation:n.avatarRotation,avatarHeight:n.avatarHeight>=.2&&n.avatarHeight<=10?n.avatarHeight:1.8,fov:n.fov}}function PS(){const n=window.parent!==window,e={embedded:n,identity:null,entered:!n,listeners:{identity:[],entered:[],dispose:[],arrival:[],party:[]},party:null,selfId:"",roster:[]},t=new Map,i=(a,l)=>e.listeners[a].forEach(c=>c(l)),s=a=>{if(a.source!==window.parent||a.origin!==window.location.origin)return;const l=a.data||{};if(l.type==="ace:identity"){const c=typeof l.name=="string"&&l.name.trim()?l.name.trim().slice(0,24):"You",u=typeof l.pfp=="string"?l.pfp:"";e.identity={name:c,pfp:u,avatarUrl:typeof l.avatarUrl=="string"?l.avatarUrl:""};const h=l.storage;if(h&&typeof h=="object")for(const d of Jc)typeof h[d]=="string"&&h[d].length<=Jf&&t.set(d,h[d]);clearInterval(o),i("identity",e.identity),e.readyPosted&&r({type:"ace:ready"})}else if(l.type==="ace:self")e.selfId=typeof l.id=="string"?l.id.slice(0,64):"",i("party",e.party);else if(l.type==="ace:peers"){const c=(Array.isArray(l.players)?l.players:[]).slice(0,7).filter(h=>h&&typeof h.id=="string"&&h.id).map(h=>({id:h.id.slice(0,64),name:typeof h.name=="string"&&h.name.trim()?h.name.trim().slice(0,24):"Player"})),u=h=>h.map(d=>`${d.id}:${d.name}`).join("|");u(c)!==u(e.roster)&&(e.roster=c,i("party",e.party))}else l.type==="ace:party"?(e.party=LS(l.party),i("party",e.party)):l.type==="ace:arrival"?i("arrival",DS(l.view)):l.type==="ace:entered"?(e.entered=!0,i("entered")):l.type==="ace:dispose"&&i("dispose")};window.addEventListener("message",s);const r=a=>{n&&window.parent.postMessage(a,window.location.origin)};e.on=(a,l)=>e.listeners[a].push(l),e.storage={get(a){if(!Jc.has(a))return null;if(n)return t.get(a)??null;try{return localStorage.getItem(`ace:${a}`)}catch{return null}},set(a,l){if(!(!Jc.has(a)||typeof l!="string"||l.length>Jf)){if(n){t.set(a,l),r({type:"ace:storage",key:a,value:l});return}try{localStorage.setItem(`ace:${a}`,l)}catch{}}}};let o=0;return e.hello=()=>{if(r({type:"ace:hello"}),!n)return;let a=0;o=setInterval(()=>{e.identity||++a>40?clearInterval(o):r({type:"ace:hello"})},250)},e.progress=()=>{},e.ready=()=>{e.readyPosted=!0,r({type:"ace:ready"})},e.arrivalReady=()=>r({type:"ace:arrival-ready"}),e.fail=a=>r({type:"ace:error",message:String(a).slice(0,200)}),e.exit=()=>{n&&r({type:"ace:exit"})},e.dispose=()=>{clearInterval(o),window.removeEventListener("message",s)},e.resolveIdentity=()=>new Promise(a=>{if(e.identity)return a(e.identity);e.on("identity",a),setTimeout(()=>{e.identity||(e.identity={...BS},a(e.identity))},n?1500:0)}),e}function bm(n){const e=Math.max(1,Math.min(8,Math.floor(n)||1)),t=[];return e===2&&t.push({id:"singles",label:"1 v 1",blurb:"One match between the two of you."}),e===4&&t.push({id:"doubles",label:"2 v 2",blurb:"Two teams of two, one match."}),e>=3&&t.push({id:"tournament",label:"Tournament",blurb:e===3?"Everyone plays everyone; most wins takes it.":e===4?"Two semi-finals, then the final.":"1 v 1 knockout down to a final."}),t.push({id:"cpu",label:e>1?"Solo vs CPU":"Play match",blurb:"A match against the house."}),t}function US(n,e){let t=2166136261;for(const r of String(e))t=Math.imul(t^r.charCodeAt(0),16777619);const i=()=>(t=Math.imul(t^t>>>15,2246822507),t=Math.imul(t^t>>>13,3266489909),((t^=t>>>16)>>>0)/4294967296),s=[...n].sort((r,o)=>r.id<o.id?-1:r.id>o.id?1:0);for(let r=s.length-1;r>0;r--){const o=Math.floor(i()*(r+1));[s[r],s[o]]=[s[o],s[r]]}return s}function FS(n,e,t=""){const i=US(e,t);if(n==="singles"&&i.length===2)return{format:n,rounds:[{name:"Match",matches:[[i[0],i[1]]]}]};if(n==="doubles"&&i.length===4){const s=[i.slice(0,2),i.slice(2,4)];return{format:n,teams:s,rounds:[{name:"Match",matches:[[s[0],s[1]]]}]}}if(n==="tournament"&&i.length===3)return{format:n,rounds:[{name:"Match 1",matches:[[i[0],i[1]]]},{name:"Match 2",matches:[[i[1],i[2]]]},{name:"Match 3",matches:[[i[0],i[2]]]}]};if(n==="tournament"&&i.length>=4){const s=[];let r=i.map(o=>o);for(;r.length>1;){const o=[],a=[],l=r.length%2;l&&a.push(r[0]);for(let c=l;c<r.length;c+=2)o.push([r[c],r[c+1]]),a.push({winnerOf:`${s.length+1}.${o.length}`});s.push({name:"",matches:o}),r=a}return s.forEach((o,a)=>{const l=s.length-a;o.name=l===1?"Final":l===2?"Semi-finals":l===3?"Quarter-finals":`Round ${a+1}`}),{format:n,rounds:s}}return null}function Kf(n,e){var t;if(Array.isArray(n))return n.map(i=>i.name).join(" & ");if(n!=null&&n.winnerOf){const[i,s]=n.winnerOf.split(".").map(Number);return`Winner of ${(((t=e==null?void 0:e[i-1])==null?void 0:t.name)??`round ${i}`).replace(/s$/,"").toLowerCase()} ${s}`}return(n==null?void 0:n.name)??"?"}const qa={KeyJ:"flat",Space:"flat",KeyK:"topspin",KeyH:"slice",KeyU:"lob"},Zf={KeyH:"KeyK",KeyK:"KeyH"};function NS(n,e){const t=new Set,i=[],s={enabled:!0,held:t,queue:i,touch:{active:!1,x:0,y:0,id:null},lastDevice:"keyboard",padPrev:[]},r=v=>i.push(v),o=v=>{if(v.repeat){["Space","ArrowUp","ArrowDown"].includes(v.code)&&v.preventDefault();return}s.lastDevice="keyboard",t.add(v.code),Zf[v.code]&&t.has(Zf[v.code])?r({type:"shot",shot:"drop"}):qa[v.code]&&r({type:"shot",shot:qa[v.code]}),(v.code==="Escape"||v.code==="KeyP")&&r({type:"pause"}),(v.code==="Enter"||v.code==="Space"||v.code==="KeyJ")&&r({type:"confirm",code:v.code}),(v.code==="Escape"||v.code==="Backspace"||v.code==="KeyK")&&r({type:"back"}),v.code==="KeyM"&&r({type:"mute"});const _={ArrowUp:"up",KeyW:"up",ArrowDown:"down",KeyS:"down",ArrowLeft:"left",KeyA:"left",ArrowRight:"right",KeyD:"right"}[v.code];_&&r({type:"nav",dir:_}),["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(v.code)&&v.preventDefault()},a=()=>Object.keys(qa).some(v=>t.has(v)),l=v=>{t.delete(v.code),qa[v.code]&&!a()&&r({type:"release"})},c=()=>t.clear(),u=v=>{if(v.target.closest&&v.target.closest("button, .touch-pad"))return;s.lastDevice="mouse";const _=v.button===2?"slice":v.button===1?"lob":"flat";r({type:"shot",shot:_,mouse:!0})},h=()=>r({type:"release"}),d=v=>v.preventDefault();window.addEventListener("keydown",o),window.addEventListener("keyup",l),window.addEventListener("blur",c),n.addEventListener("mousedown",u),window.addEventListener("mouseup",h),n.addEventListener("contextmenu",d);const f=e.querySelector(".touch-stick"),A=e.querySelector(".touch-knob"),g=new Set,m=v=>{s.lastDevice="touch",document.body.classList.add("is-touch");for(const _ of v.changedTouches){const x=_.target.closest&&_.target.closest("[data-shot]");if(x){r({type:"shot",shot:x.dataset.shot}),r({type:"confirm"}),g.add(_.identifier),x.classList.add("down"),setTimeout(()=>x.classList.remove("down"),140);continue}_.target.closest&&_.target.closest("button")||_.clientX<window.innerWidth*.5&&s.touch.id===null&&(s.touch={active:!0,id:_.identifier,ox:_.clientX,oy:_.clientY,x:0,y:0},f.style.left=`${_.clientX}px`,f.style.top=`${_.clientY}px`,f.classList.add("on"))}},p=v=>{for(const _ of v.changedTouches){if(_.identifier!==s.touch.id)continue;const x=_.clientX-s.touch.ox,S=_.clientY-s.touch.oy,I=46,L=Math.hypot(x,S),y=L>I?I/L:1;s.touch.x=x*y/I,s.touch.y=-S*y/I,A.style.transform=`translate(${x*y}px, ${S*y}px)`}v.preventDefault()},E=v=>{for(const _ of v.changedTouches){if(g.delete(_.identifier)){g.size||r({type:"release"});continue}_.identifier===s.touch.id&&(s.touch={active:!1,id:null,x:0,y:0},A.style.transform="",f.classList.remove("on"))}};return window.addEventListener("touchstart",m,{passive:!0}),window.addEventListener("touchmove",p,{passive:!1}),window.addEventListener("touchend",E),window.addEventListener("touchcancel",E),s.dispose=()=>{window.removeEventListener("keydown",o),window.removeEventListener("keyup",l),window.removeEventListener("blur",c),n.removeEventListener("mousedown",u),window.removeEventListener("mouseup",h),n.removeEventListener("contextmenu",d),window.removeEventListener("touchstart",m),window.removeEventListener("touchmove",p),window.removeEventListener("touchend",E),window.removeEventListener("touchcancel",E)},s}function OS(n){const e=n.held;let t=(e.has("KeyD")||e.has("ArrowRight")?1:0)-(e.has("KeyA")||e.has("ArrowLeft")?1:0),i=(e.has("KeyW")||e.has("ArrowUp")?1:0)-(e.has("KeyS")||e.has("ArrowDown")?1:0);n.touch.active&&(t=n.touch.x,i=n.touch.y);const s=n.queue.splice(0),r=navigator.getGamepads?navigator.getGamepads():[];for(const a of r){if(!a)continue;const l=a.axes[0]||0,c=a.axes[1]||0;Math.hypot(l,c)>.2&&(t=l,i=-c,n.lastDevice="pad");const u=A=>!!(a.buttons[A]&&a.buttons[A].pressed);u(12)&&(i=1),u(13)&&(i=-1),u(14)&&(t=-1),u(15)&&(t=1);const h=n.padPrev[a.index]||[],d=A=>u(A)&&!h[A];d(0)&&s.push({type:"shot",shot:"flat"},{type:"confirm",pad:!0}),d(1)&&s.push({type:"shot",shot:"slice"},{type:"back"}),d(2)&&s.push({type:"shot",shot:"topspin"}),d(3)&&s.push({type:"shot",shot:"lob"}),(d(4)||d(5))&&s.push({type:"shot",shot:"drop"});const f=[0,1,2,3,4,5];f.some(A=>h[A]&&!u(A))&&!f.some(A=>u(A))&&s.push({type:"release"}),d(9)&&s.push({type:"pause",pad:!0}),d(12)&&s.push({type:"nav",dir:"up"}),d(13)&&s.push({type:"nav",dir:"down"}),d(14)&&s.push({type:"nav",dir:"left"}),d(15)&&s.push({type:"nav",dir:"right"}),[0,1,2,3,4,5,9,12,13,14,15].some(d)&&(n.lastDevice="pad"),n.padPrev[a.index]=a.buttons.map(A=>A.pressed)}const o=Math.hypot(t,i);return o>1&&(t/=o,i/=o),n.enabled||(t=0,i=0),{x:t,y:i,events:n.enabled?s:s.filter(a=>a.type==="pause")}}function ym(n){n.held.clear(),n.queue.length=0}const Zi=.05;function Jl(n,e,t,i={}){const s=document.createElement("canvas");s.width=n,s.height=e,t(s.getContext("2d"),n,e);const r=new Gr(s);return r.colorSpace=Bt,r.anisotropy=i.anisotropy||8,i.repeat&&(r.wrapS=r.wrapT=Es,r.repeat.set(i.repeat[0],i.repeat[1])),r}function kS(){const n=new Xt(400,32,16),e=new Mn({side:Yt,depthWrite:!1,uniforms:{top:{value:new ye(3111935)},mid:{value:new ye(9425151)},bottom:{value:new ye(15334399)},sun:{value:new w(-.4,.55,-.73).normalize()}},vertexShader:`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }`,fragmentShader:`
      uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 sun;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 c = mix(bottom, mid, smoothstep(-0.02, 0.18, h));
        c = mix(c, top, smoothstep(0.18, 0.75, h));
        float s = max(dot(vDir, sun), 0.0);
        c += vec3(1.0, 0.95, 0.8) * (pow(s, 600.0) * 1.5 + pow(s, 12.0) * 0.18);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`}),t=new Me(n,e);return t.renderOrder=-10,t.frustumCulled=!1,t}function QS(n){const e=new Ct,t=st(16777215,{emissive:6979496}),i=4+Math.floor(n()*4);for(let s=0;s<i;s++){const r=3+n()*4,o=new Me(new Xt(r,14,10),t);o.position.set((s-i/2)*4+n()*2,n()*2.5,n()*3),o.scale.y=.75,e.add(o)}return e}function HS(n){const e=new Ct,t=new Me(new si(.25,.35,2.2,8),st(9067067));t.position.y=1.1,e.add(t);const i=st([3650378,3055173,5030746][Math.floor(n()*3)]),s=new Me(new Xt(1.7+n()*.8,14,10),i);s.position.y=3.3,s.castShadow=!0,e.add(s),Ei(s,.05,1915434);const r=new Me(new Xt(1.1,12,8),i);return r.position.set(.9,2.6,.4),e.add(r),e.scale.setScalar(.9+n()*.6),e}function Kc(n,e,t){return Jl(1024,128,(i,s,r)=>{i.fillStyle=e,i.fillRect(0,0,s,r),i.fillStyle="rgba(255,255,255,0.14)";for(let o=-r;o<s;o+=48)i.beginPath(),i.moveTo(o,r),i.lineTo(o+24,r),i.lineTo(o+24+r,0),i.lineTo(o+r,0),i.fill();i.fillStyle=t,i.font="italic 900 84px 'Arial Black', sans-serif",i.textAlign="center",i.textBaseline="middle";for(let o=s*.25;o<s;o+=s*.5)i.fillText(n,o,r*.54)},{repeat:[1,1]})}function GS(){return Jl(512,64,(n,e,t)=>{n.clearRect(0,0,e,t),n.strokeStyle="rgba(20,20,30,0.85)",n.lineWidth=2;for(let i=0;i<=e;i+=8)n.beginPath(),n.moveTo(i,0),n.lineTo(i,t),n.stroke();for(let i=0;i<=t;i+=8)n.beginPath(),n.moveTo(0,i),n.lineTo(e,i),n.stroke()},{repeat:[6,1]})}function zS(){return Jl(512,512,(n,e,t)=>{n.fillStyle="#5cc45a",n.fillRect(0,0,e,t);for(let i=0;i<8;i++)i%2||(n.fillStyle="#54b953",n.fillRect(0,i*t/8,e,t/8))},{repeat:[14,14]})}function VS(){return Jl(512,512,(n,e,t)=>{n.fillStyle="#3a6fe0",n.fillRect(0,0,e,t);const i=n.getImageData(0,0,e,t);for(let s=0;s<i.data.length;s+=4){const r=(Math.random()-.5)*14;i.data[s]+=r,i.data[s+1]+=r,i.data[s+2]+=r}n.putImageData(i,0,0)},{repeat:[6,12]})}function WS(n,e=Math.random){const t={crowd:null,flags:[],clouds:[],excite:0,wave:0,time:0,screen:null};n.add(kS());const i=new wv(13625599,5933642,1.25);n.add(i);const s=new $A(16773852,2.6);s.position.set(-12,26,-8),s.castShadow=!0,s.shadow.mapSize.set(2048,2048);const r=s.shadow.camera;r.left=-16,r.right=16,r.top=20,r.bottom=-20,r.near=5,r.far=70,s.shadow.bias=-6e-4,s.shadow.normalBias=.02,s.shadow.radius=3,n.add(s),n.add(s.target),t.sun=s;const o=new Me(new En(220,220),new $s({map:zS()}));o.rotation.x=-Math.PI/2,o.position.y=-.02,o.receiveShadow=!0,n.add(o);const a=new Me(new En(Ne.doublesHalfWidth*2+8,Ne.halfLength*2+13),new $s({color:3122027}));a.rotation.x=-Math.PI/2,a.position.y=-.005,a.receiveShadow=!0,n.add(a);const l=new Me(new En(Ne.doublesHalfWidth*2+.6,Ne.halfLength*2+.6),new $s({map:VS()}));l.rotation.x=-Math.PI/2,l.receiveShadow=!0,n.add(l);const c=new $s({color:16777215,emissive:7043737}),u=new Ct,h=(re,Ie,B,$)=>{const j=new Me(new xn(B,.004,$),c);j.position.set(re,.003,Ie),j.receiveShadow=!0,u.add(j)},d=Ne.halfLength;for(const re of[-1,1])h(0,re*d,Ne.doublesHalfWidth*2+Zi,Zi*1.6),h(re*Ne.halfWidth,0,Zi,d*2),h(re*Ne.doublesHalfWidth,0,Zi,d*2),h(0,re*Ne.serviceLine,Ne.halfWidth*2,Zi),h(0,re*(Ne.serviceLine/2),Zi,Ne.serviceLine),h(0,re*(d-.1),Zi,.2);n.add(u);const f=new Ct,A=Ne.postX*2,g=new En(A,1,40,4),m=g.attributes.position;for(let re=0;re<m.count;re++){const Ie=m.getX(re),B=Ne.netCenter+(Ne.netPost-Ne.netCenter)*Math.pow(Math.min(1,Math.abs(Ie)/Ne.postX),2),$=m.getY(re)+.5;m.setY(re,$*B)}g.computeVertexNormals();const p=new Me(g,new $s({map:GS(),transparent:!0,side:nn,alphaTest:.2}));p.castShadow=!0,f.add(p);const E=[];for(let re=0;re<=24;re++){const Ie=-5.03+re/24*A,B=Ne.netCenter+(Ne.netPost-Ne.netCenter)*Math.pow(Math.abs(Ie)/Ne.postX,2);E.push(new w(Ie,B,0))}const v=new Me(new Fh(new OA(E),48,.03,6),st(16777215));v.castShadow=!0,f.add(v);const _=new Me(new xn(.05,Ne.netCenter,.01),st(16777215));_.position.y=Ne.netCenter/2,f.add(_);for(const re of[-1,1]){const Ie=new Me(new si(.05,.05,Ne.netPost+.08,12),st(1911631));Ie.position.set(re*Ne.postX,(Ne.netPost+.08)/2,0),Ie.castShadow=!0,f.add(Ie),Ei(Ie,.012);const B=new Me(new Xt(.07,10,8),st(16765500));B.position.set(re*Ne.postX,Ne.netPost+.1,0),f.add(B)}n.add(f),t.net=p;const x=1,S=[Kc("ACE!","#ff4d5e","#ffffff"),Kc("ONCYBER","#1d2b4f","#ffd23c"),Kc("RALLY!","#ffb01f","#1d2b4f")],I=re=>new $s({map:S[re%S.length],emissive:2236962}),L=Ne.doublesHalfWidth+4.6,y=Ne.halfLength+7.2,b=(re,Ie,B,$,j)=>{const q=new Me(new xn(B,x,.2),[st(1911631),st(1911631),st(16777215),st(1911631),I(j),I(j)]);q.position.set(re,x/2,Ie),q.rotation.y=$,q.castShadow=!0,q.receiveShadow=!0,n.add(q)};b(0,-y,L*2,0,0),b(0,y,L*2,Math.PI,1);for(const re of[-1,1])b(re*L,-y/2,y,-re*Math.PI/2,2),b(re*L,y/2,y,-re*Math.PI/2,1);const R=[],U=st(15265013),N=st(10465494),G=7,V=(re,Ie,B,$)=>{const j=new Ct;for(let q=0;q<G;q++){const Z=new Me(new xn(B,.55,1.1),[N,N,U,N,N,N]);Z.position.set(0,.55*q+.27+1.2,-(q*1.1+.55)),Z.receiveShadow=!0,j.add(Z);const Ae=new Me(new xn(B,.55*q+1.2,1.1),N);Ae.position.set(0,(.55*q+1.2)/2,-(q*1.1+.55)),j.add(Ae);const oe=Math.floor(B/.72);for(let pe=0;pe<oe;pe++){if(e()<.12)continue;const We=new w(-B/2+.36+pe*.72+(e()-.5)*.1,.55*q+.55+1.2,-(q*1.1+.6));R.push({local:We,stand:j,row:q})}}return j.position.set(re,0,Ie),j.rotation.y=$,n.add(j),j},P=L+1.4;V(-P,0,(y-1)*2,Math.PI/2),V(P,0,(y-1)*2,-Math.PI/2),V(0,-20.485,L*2+4,0),n.updateMatrixWorld(!0);const Y=[16731486,4029439,16765500,2871678,16777215,16747224,10185727,16751164],H=[16765616,15316108,13011551,9263675,16769218],te=R.length,se=new jo(.2,.25,4,8),ae=new Xt(.17,10,8),ve=new Zu(se,st(16777215,{unique:!0}),te),Oe=new Zu(ae,st(16777215,{unique:!0}),te),Ke=new ye,$e=[];for(let re=0;re<te;re++){const Ie=R[re],B=Ie.local.clone().applyMatrix4(Ie.stand.matrixWorld);$e.push({p:B,phase:e()*Math.PI*2,freq:7+e()*5,energy:.5+e()*.8}),ve.setColorAt(re,Ke.setHex(Y[Math.floor(e()*Y.length)])),Oe.setColorAt(re,Ke.setHex(H[Math.floor(e()*H.length)]))}ve.instanceColor.needsUpdate=!0,Oe.instanceColor.needsUpdate=!0,n.add(ve),n.add(Oe),t.crowd={bodies:ve,heads:Oe,base:$e,count:te};const K=new Ct,ne=st(1911631);for(const[re,Ie]of[[-.35,-.35],[.35,-.35],[-.35,.35],[.35,.35]]){const B=new Me(new si(.04,.05,2,6),ne);B.position.set(re,1,Ie),K.add(B)}const be=new Me(new xn(.9,.12,.9),st(16731486));be.position.y=2.05,K.add(be);const Le=new Me(new xn(.9,.7,.1),st(16731486));Le.position.set(0,2.45,.42),K.add(Le),K.position.set(Ne.postX+1.4,0,0),K.rotation.y=-Math.PI/2,K.traverse(re=>re.castShadow=!0),n.add(K),t.umpireSeat=new w(Ne.postX+1.4,2.1,0);const Se=[16731486,4029439,16765500,2871678];for(let re=0;re<6;re++){const Ie=-15+re*6,B=-29.585,$=new Me(new si(.06,.06,7,6),st(14540253));$.position.set(Ie,3.5+3.8,B),n.add($);const j=new En(1.8,1.1,12,4);j.translate(.9,0,0);const q=new Me(j,st(Se[re%4],{unique:!0}));q.material.side=nn,q.position.set(Ie,10.2,B),q.userData.base=j.attributes.position.array.slice(),n.add(q),t.flags.push(q)}for(let re=0;re<26;re++){const Ie=re/26*Math.PI*2,B=42+e()*14,$=HS(e);$.position.set(Math.cos(Ie)*B,0,Math.sin(Ie)*B),n.add($)}for(let re=0;re<9;re++){const Ie=re/9*Math.PI*2+.3,B=new Me(new Xt(30+e()*25,20,12),st(re%2?5224538:4565074));B.position.set(Math.cos(Ie)*150,-18,Math.sin(Ie)*150),B.scale.y=.55,n.add(B)}for(let re=0;re<9;re++){const Ie=QS(e);Ie.position.set(-160+re*40+e()*15,38+e()*25,-120-e()*60),Ie.scale.setScalar(1.4+e()),n.add(Ie),t.clouds.push(Ie)}return t}const Xa=new Qe,$f=new je,ep=new w(1,1,1),nr=new w;function ur(n,e=1){n.excite=Math.min(1.4,n.excite+e)}function qS(n,e,t){n.time+=e,n.excite=Math.max(0,n.excite-e*.35);const i=n.time,s=n.crowd,r=n.excite;for(let o=0;o<s.count;o++){const a=s.base[o],l=Math.max(0,Math.sin(i*a.freq*(.4+r*.6)+a.phase))*(.03+r*.32*a.energy);nr.copy(a.p),nr.y+=l,Xa.compose(nr,$f,ep),s.bodies.setMatrixAt(o,Xa),nr.y+=.42,t&&(nr.x+=Math.sign(t.x-a.p.x)*.02),Xa.compose(nr,$f,ep),s.heads.setMatrixAt(o,Xa)}s.bodies.instanceMatrix.needsUpdate=!0,s.heads.instanceMatrix.needsUpdate=!0;for(const o of n.flags){const a=o.geometry.attributes.position,l=o.userData.base;for(let c=0;c<a.count;c++){const u=l[c*3];a.setZ(c,Math.sin(u*2.4-i*5+o.position.x)*.16*u)}a.needsUpdate=!0}for(const o of n.clouds)o.position.x+=e*.8,o.position.x>200&&(o.position.x=-200)}function tp(n,e){if(e===C0)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),n;if(e===ju||e===gA){let t=n.getIndex();if(t===null){const o=[],a=n.getAttribute("position");if(a!==void 0){for(let l=0;l<a.count;l++)o.push(l);n.setIndex(o),t=n.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),n}const i=t.count-2,s=[];if(e===ju)for(let o=1;o<=i;o++)s.push(t.getX(0)),s.push(t.getX(o)),s.push(t.getX(o+1));else for(let o=0;o<i;o++)o%2===0?(s.push(t.getX(o)),s.push(t.getX(o+1)),s.push(t.getX(o+2))):(s.push(t.getX(o+2)),s.push(t.getX(o+1)),s.push(t.getX(o)));s.length/3!==i&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");const r=n.clone();return r.setIndex(s),r.clearGroups(),r}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",e),n}class XS extends Rs{constructor(e){super(e),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(t){return new ZS(t)}),this.register(function(t){return new $S(t)}),this.register(function(t){return new lw(t)}),this.register(function(t){return new cw(t)}),this.register(function(t){return new uw(t)}),this.register(function(t){return new tw(t)}),this.register(function(t){return new nw(t)}),this.register(function(t){return new iw(t)}),this.register(function(t){return new sw(t)}),this.register(function(t){return new KS(t)}),this.register(function(t){return new rw(t)}),this.register(function(t){return new ew(t)}),this.register(function(t){return new aw(t)}),this.register(function(t){return new ow(t)}),this.register(function(t){return new jS(t)}),this.register(function(t){return new hw(t)}),this.register(function(t){return new dw(t)})}load(e,t,i,s){const r=this;let o;if(this.resourcePath!=="")o=this.resourcePath;else if(this.path!==""){const c=Do.extractUrlBase(e);o=Do.resolveURL(c,this.path)}else o=Do.extractUrlBase(e);this.manager.itemStart(e);const a=function(c){s?s(c):console.error(c),r.manager.itemError(e),r.manager.itemEnd(e)},l=new Lo(this.manager);l.setPath(this.path),l.setResponseType("arraybuffer"),l.setRequestHeader(this.requestHeader),l.setWithCredentials(this.withCredentials),l.load(e,function(c){try{r.parse(c,o,function(u){t(u),r.manager.itemEnd(e)},a)}catch(u){a(u)}},i,a)}setDRACOLoader(e){return this.dracoLoader=e,this}setKTX2Loader(e){return this.ktx2Loader=e,this}setMeshoptDecoder(e){return this.meshoptDecoder=e,this}register(e){return this.pluginCallbacks.indexOf(e)===-1&&this.pluginCallbacks.push(e),this}unregister(e){return this.pluginCallbacks.indexOf(e)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e),1),this}parse(e,t,i,s){let r;const o={},a={},l=new TextDecoder;if(typeof e=="string")r=JSON.parse(e);else if(e instanceof ArrayBuffer)if(l.decode(new Uint8Array(e,0,4))===Mm){try{o[rt.KHR_BINARY_GLTF]=new fw(e)}catch(h){s&&s(h);return}r=JSON.parse(o[rt.KHR_BINARY_GLTF].content)}else r=JSON.parse(l.decode(e));else r=e;if(r.asset===void 0||r.asset.version[0]<2){s&&s(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}const c=new ww(r,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});c.fileLoader.setRequestHeader(this.requestHeader);for(let u=0;u<this.pluginCallbacks.length;u++){const h=this.pluginCallbacks[u](c);h.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),a[h.name]=h,o[h.name]=!0}if(r.extensionsUsed)for(let u=0;u<r.extensionsUsed.length;++u){const h=r.extensionsUsed[u],d=r.extensionsRequired||[];switch(h){case rt.KHR_MATERIALS_UNLIT:o[h]=new JS;break;case rt.KHR_DRACO_MESH_COMPRESSION:o[h]=new pw(r,this.dracoLoader);break;case rt.KHR_TEXTURE_TRANSFORM:o[h]=new Aw;break;case rt.KHR_MESH_QUANTIZATION:o[h]=new mw;break;default:d.indexOf(h)>=0&&a[h]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+h+'".')}}c.setExtensions(o),c.setPlugins(a),c.parse(i,s)}parseAsync(e,t){const i=this;return new Promise(function(s,r){i.parse(e,t,s,r)})}}function YS(){let n={};return{get:function(e){return n[e]},add:function(e,t){n[e]=t},remove:function(e){delete n[e]},removeAll:function(){n={}}}}const rt={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"};class jS{constructor(e){this.parser=e,this.name=rt.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){const e=this.parser,t=this.parser.json.nodes||[];for(let i=0,s=t.length;i<s;i++){const r=t[i];r.extensions&&r.extensions[this.name]&&r.extensions[this.name].light!==void 0&&e._addNodeRef(this.cache,r.extensions[this.name].light)}}_loadLight(e){const t=this.parser,i="light:"+e;let s=t.cache.get(i);if(s)return s;const r=t.json,l=((r.extensions&&r.extensions[this.name]||{}).lights||[])[e];let c;const u=new ye(16777215);l.color!==void 0&&u.setRGB(l.color[0],l.color[1],l.color[2],rn);const h=l.range!==void 0?l.range:0;switch(l.type){case"directional":c=new $A(u),c.target.position.set(0,0,-1),c.add(c.target);break;case"point":c=new Rv(u),c.distance=h;break;case"spot":c=new Iv(u),c.distance=h,l.spot=l.spot||{},l.spot.innerConeAngle=l.spot.innerConeAngle!==void 0?l.spot.innerConeAngle:0,l.spot.outerConeAngle=l.spot.outerConeAngle!==void 0?l.spot.outerConeAngle:Math.PI/4,c.angle=l.spot.outerConeAngle,c.penumbra=1-l.spot.innerConeAngle/l.spot.outerConeAngle,c.target.position.set(0,0,-1),c.add(c.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+l.type)}return c.position.set(0,0,0),$n(c,l),l.intensity!==void 0&&(c.intensity=l.intensity),c.name=t.createUniqueName(l.name||"light_"+e),s=Promise.resolve(c),t.cache.add(i,s),s}getDependency(e,t){if(e==="light")return this._loadLight(t)}createNodeAttachment(e){const t=this,i=this.parser,r=i.json.nodes[e],a=(r.extensions&&r.extensions[this.name]||{}).light;return a===void 0?null:this._loadLight(a).then(function(l){return i._getNodeRef(t.cache,a,l)})}}class JS{constructor(){this.name=rt.KHR_MATERIALS_UNLIT}getMaterialType(){return dn}extendParams(e,t,i){const s=[];e.color=new ye(1,1,1),e.opacity=1;const r=t.pbrMetallicRoughness;if(r){if(Array.isArray(r.baseColorFactor)){const o=r.baseColorFactor;e.color.setRGB(o[0],o[1],o[2],rn),e.opacity=o[3]}r.baseColorTexture!==void 0&&s.push(i.assignTexture(e,"map",r.baseColorTexture,Bt))}return Promise.all(s)}}class KS{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(e,t){const s=this.parser.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const r=s.extensions[this.name].emissiveStrength;return r!==void 0&&(t.emissiveIntensity=r),Promise.resolve()}}class ZS{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_CLEARCOAT}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:ci}extendMaterialParams(e,t){const i=this.parser,s=i.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const r=[],o=s.extensions[this.name];if(o.clearcoatFactor!==void 0&&(t.clearcoat=o.clearcoatFactor),o.clearcoatTexture!==void 0&&r.push(i.assignTexture(t,"clearcoatMap",o.clearcoatTexture)),o.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=o.clearcoatRoughnessFactor),o.clearcoatRoughnessTexture!==void 0&&r.push(i.assignTexture(t,"clearcoatRoughnessMap",o.clearcoatRoughnessTexture)),o.clearcoatNormalTexture!==void 0&&(r.push(i.assignTexture(t,"clearcoatNormalMap",o.clearcoatNormalTexture)),o.clearcoatNormalTexture.scale!==void 0)){const a=o.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new ce(a,a)}return Promise.all(r)}}class $S{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_DISPERSION}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:ci}extendMaterialParams(e,t){const s=this.parser.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const r=s.extensions[this.name];return t.dispersion=r.dispersion!==void 0?r.dispersion:0,Promise.resolve()}}class ew{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_IRIDESCENCE}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:ci}extendMaterialParams(e,t){const i=this.parser,s=i.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const r=[],o=s.extensions[this.name];return o.iridescenceFactor!==void 0&&(t.iridescence=o.iridescenceFactor),o.iridescenceTexture!==void 0&&r.push(i.assignTexture(t,"iridescenceMap",o.iridescenceTexture)),o.iridescenceIor!==void 0&&(t.iridescenceIOR=o.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),o.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=o.iridescenceThicknessMinimum),o.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=o.iridescenceThicknessMaximum),o.iridescenceThicknessTexture!==void 0&&r.push(i.assignTexture(t,"iridescenceThicknessMap",o.iridescenceThicknessTexture)),Promise.all(r)}}class tw{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_SHEEN}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:ci}extendMaterialParams(e,t){const i=this.parser,s=i.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const r=[];t.sheenColor=new ye(0,0,0),t.sheenRoughness=0,t.sheen=1;const o=s.extensions[this.name];if(o.sheenColorFactor!==void 0){const a=o.sheenColorFactor;t.sheenColor.setRGB(a[0],a[1],a[2],rn)}return o.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=o.sheenRoughnessFactor),o.sheenColorTexture!==void 0&&r.push(i.assignTexture(t,"sheenColorMap",o.sheenColorTexture,Bt)),o.sheenRoughnessTexture!==void 0&&r.push(i.assignTexture(t,"sheenRoughnessMap",o.sheenRoughnessTexture)),Promise.all(r)}}class nw{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_TRANSMISSION}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:ci}extendMaterialParams(e,t){const i=this.parser,s=i.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const r=[],o=s.extensions[this.name];return o.transmissionFactor!==void 0&&(t.transmission=o.transmissionFactor),o.transmissionTexture!==void 0&&r.push(i.assignTexture(t,"transmissionMap",o.transmissionTexture)),Promise.all(r)}}class iw{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_VOLUME}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:ci}extendMaterialParams(e,t){const i=this.parser,s=i.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const r=[],o=s.extensions[this.name];t.thickness=o.thicknessFactor!==void 0?o.thicknessFactor:0,o.thicknessTexture!==void 0&&r.push(i.assignTexture(t,"thicknessMap",o.thicknessTexture)),t.attenuationDistance=o.attenuationDistance||1/0;const a=o.attenuationColor||[1,1,1];return t.attenuationColor=new ye().setRGB(a[0],a[1],a[2],rn),Promise.all(r)}}class sw{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_IOR}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:ci}extendMaterialParams(e,t){const s=this.parser.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const r=s.extensions[this.name];return t.ior=r.ior!==void 0?r.ior:1.5,Promise.resolve()}}class rw{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_SPECULAR}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:ci}extendMaterialParams(e,t){const i=this.parser,s=i.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const r=[],o=s.extensions[this.name];t.specularIntensity=o.specularFactor!==void 0?o.specularFactor:1,o.specularTexture!==void 0&&r.push(i.assignTexture(t,"specularIntensityMap",o.specularTexture));const a=o.specularColorFactor||[1,1,1];return t.specularColor=new ye().setRGB(a[0],a[1],a[2],rn),o.specularColorTexture!==void 0&&r.push(i.assignTexture(t,"specularColorMap",o.specularColorTexture,Bt)),Promise.all(r)}}class ow{constructor(e){this.parser=e,this.name=rt.EXT_MATERIALS_BUMP}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:ci}extendMaterialParams(e,t){const i=this.parser,s=i.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const r=[],o=s.extensions[this.name];return t.bumpScale=o.bumpFactor!==void 0?o.bumpFactor:1,o.bumpTexture!==void 0&&r.push(i.assignTexture(t,"bumpMap",o.bumpTexture)),Promise.all(r)}}class aw{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_ANISOTROPY}getMaterialType(e){const i=this.parser.json.materials[e];return!i.extensions||!i.extensions[this.name]?null:ci}extendMaterialParams(e,t){const i=this.parser,s=i.json.materials[e];if(!s.extensions||!s.extensions[this.name])return Promise.resolve();const r=[],o=s.extensions[this.name];return o.anisotropyStrength!==void 0&&(t.anisotropy=o.anisotropyStrength),o.anisotropyRotation!==void 0&&(t.anisotropyRotation=o.anisotropyRotation),o.anisotropyTexture!==void 0&&r.push(i.assignTexture(t,"anisotropyMap",o.anisotropyTexture)),Promise.all(r)}}class lw{constructor(e){this.parser=e,this.name=rt.KHR_TEXTURE_BASISU}loadTexture(e){const t=this.parser,i=t.json,s=i.textures[e];if(!s.extensions||!s.extensions[this.name])return null;const r=s.extensions[this.name],o=t.options.ktx2Loader;if(!o){if(i.extensionsRequired&&i.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return t.loadTextureImage(e,r.source,o)}}class cw{constructor(e){this.parser=e,this.name=rt.EXT_TEXTURE_WEBP}loadTexture(e){const t=this.name,i=this.parser,s=i.json,r=s.textures[e];if(!r.extensions||!r.extensions[t])return null;const o=r.extensions[t],a=s.images[o.source];let l=i.textureLoader;if(a.uri){const c=i.options.manager.getHandler(a.uri);c!==null&&(l=c)}return i.loadTextureImage(e,o.source,l)}}class uw{constructor(e){this.parser=e,this.name=rt.EXT_TEXTURE_AVIF}loadTexture(e){const t=this.name,i=this.parser,s=i.json,r=s.textures[e];if(!r.extensions||!r.extensions[t])return null;const o=r.extensions[t],a=s.images[o.source];let l=i.textureLoader;if(a.uri){const c=i.options.manager.getHandler(a.uri);c!==null&&(l=c)}return i.loadTextureImage(e,o.source,l)}}class hw{constructor(e){this.name=rt.EXT_MESHOPT_COMPRESSION,this.parser=e}loadBufferView(e){const t=this.parser.json,i=t.bufferViews[e];if(i.extensions&&i.extensions[this.name]){const s=i.extensions[this.name],r=this.parser.getDependency("buffer",s.buffer),o=this.parser.options.meshoptDecoder;if(!o||!o.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return r.then(function(a){const l=s.byteOffset||0,c=s.byteLength||0,u=s.count,h=s.byteStride,d=new Uint8Array(a,l,c);return o.decodeGltfBufferAsync?o.decodeGltfBufferAsync(u,h,d,s.mode,s.filter).then(function(f){return f.buffer}):o.ready.then(function(){const f=new ArrayBuffer(u*h);return o.decodeGltfBuffer(new Uint8Array(f),u,h,d,s.mode,s.filter),f})})}else return null}}class dw{constructor(e){this.name=rt.EXT_MESH_GPU_INSTANCING,this.parser=e}createNodeMesh(e){const t=this.parser.json,i=t.nodes[e];if(!i.extensions||!i.extensions[this.name]||i.mesh===void 0)return null;const s=t.meshes[i.mesh];for(const c of s.primitives)if(c.mode!==Rn.TRIANGLES&&c.mode!==Rn.TRIANGLE_STRIP&&c.mode!==Rn.TRIANGLE_FAN&&c.mode!==void 0)return null;const o=i.extensions[this.name].attributes,a=[],l={};for(const c in o)a.push(this.parser.getDependency("accessor",o[c]).then(u=>(l[c]=u,l[c])));return a.length<1?null:(a.push(this.parser.createNodeMesh(e)),Promise.all(a).then(c=>{const u=c.pop(),h=u.isGroup?u.children:[u],d=c[0].count,f=[];for(const A of h){const g=new Qe,m=new w,p=new je,E=new w(1,1,1),v=new Zu(A.geometry,A.material,d);for(let _=0;_<d;_++)l.TRANSLATION&&m.fromBufferAttribute(l.TRANSLATION,_),l.ROTATION&&p.fromBufferAttribute(l.ROTATION,_),l.SCALE&&E.fromBufferAttribute(l.SCALE,_),v.setMatrixAt(_,g.compose(m,p,E));for(const _ in l)if(_==="_COLOR_0"){const x=l[_];v.instanceColor=new Ku(x.array,x.itemSize,x.normalized)}else _!=="TRANSLATION"&&_!=="ROTATION"&&_!=="SCALE"&&A.geometry.setAttribute(_,l[_]);vt.prototype.copy.call(v,A),this.parser.assignFinalMaterial(v),f.push(v)}return u.isGroup?(u.clear(),u.add(...f),u):f[0]}))}}const Mm="glTF",uo=12,np={JSON:1313821514,BIN:5130562};class fw{constructor(e){this.name=rt.KHR_BINARY_GLTF,this.content=null,this.body=null;const t=new DataView(e,0,uo),i=new TextDecoder;if(this.header={magic:i.decode(new Uint8Array(e.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==Mm)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");const s=this.header.length-uo,r=new DataView(e,uo);let o=0;for(;o<s;){const a=r.getUint32(o,!0);o+=4;const l=r.getUint32(o,!0);if(o+=4,l===np.JSON){const c=new Uint8Array(e,uo+o,a);this.content=i.decode(c)}else if(l===np.BIN){const c=uo+o;this.body=e.slice(c,c+a)}o+=a}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}}class pw{constructor(e,t){if(!t)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=rt.KHR_DRACO_MESH_COMPRESSION,this.json=e,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(e,t){const i=this.json,s=this.dracoLoader,r=e.extensions[this.name].bufferView,o=e.extensions[this.name].attributes,a={},l={},c={};for(const u in o){const h=rh[u]||u.toLowerCase();a[h]=o[u]}for(const u in e.attributes){const h=rh[u]||u.toLowerCase();if(o[u]!==void 0){const d=i.accessors[e.attributes[u]],f=Sr[d.componentType];c[h]=f.name,l[h]=d.normalized===!0}}return t.getDependency("bufferView",r).then(function(u){return new Promise(function(h,d){s.decodeDracoFile(u,function(f){for(const A in f.attributes){const g=f.attributes[A],m=l[A];m!==void 0&&(g.normalized=m)}h(f)},a,c,rn,d)})})}}class Aw{constructor(){this.name=rt.KHR_TEXTURE_TRANSFORM}extendTexture(e,t){return(t.texCoord===void 0||t.texCoord===e.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0||(e=e.clone(),t.texCoord!==void 0&&(e.channel=t.texCoord),t.offset!==void 0&&e.offset.fromArray(t.offset),t.rotation!==void 0&&(e.rotation=t.rotation),t.scale!==void 0&&e.repeat.fromArray(t.scale),e.needsUpdate=!0),e}}class mw{constructor(){this.name=rt.KHR_MESH_QUANTIZATION}}class Sm extends sa{constructor(e,t,i,s){super(e,t,i,s)}copySampleValue_(e){const t=this.resultBuffer,i=this.sampleValues,s=this.valueSize,r=e*s*3+s;for(let o=0;o!==s;o++)t[o]=i[r+o];return t}interpolate_(e,t,i,s){const r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=a*2,c=a*3,u=s-t,h=(i-t)/u,d=h*h,f=d*h,A=e*c,g=A-c,m=-2*f+3*d,p=f-d,E=1-m,v=p-d+h;for(let _=0;_!==a;_++){const x=o[g+_+a],S=o[g+_+l]*u,I=o[A+_+a],L=o[A+_]*u;r[_]=E*x+v*S+m*I+p*L}return r}}const gw=new je;class _w extends Sm{interpolate_(e,t,i,s){const r=super.interpolate_(e,t,i,s);return gw.fromArray(r).normalize().toArray(r),r}}const Rn={POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6},Sr={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},ip={9728:Gt,9729:Jt,9984:xh,9985:rl,9986:Eo,9987:Gn},sp={33071:bi,33648:ml,10497:Es},Zc={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},rh={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},Fi={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},vw={CUBICSPLINE:void 0,LINEAR:qo,STEP:Wo},$c={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function xw(n){return n.DefaultMaterial===void 0&&(n.DefaultMaterial=new Nh({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:Ci})),n.DefaultMaterial}function $i(n,e,t){for(const i in t.extensions)n[i]===void 0&&(e.userData.gltfExtensions=e.userData.gltfExtensions||{},e.userData.gltfExtensions[i]=t.extensions[i])}function $n(n,e){e.extras!==void 0&&(typeof e.extras=="object"?Object.assign(n.userData,e.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+e.extras))}function Ew(n,e,t){let i=!1,s=!1,r=!1;for(let c=0,u=e.length;c<u;c++){const h=e[c];if(h.POSITION!==void 0&&(i=!0),h.NORMAL!==void 0&&(s=!0),h.COLOR_0!==void 0&&(r=!0),i&&s&&r)break}if(!i&&!s&&!r)return Promise.resolve(n);const o=[],a=[],l=[];for(let c=0,u=e.length;c<u;c++){const h=e[c];if(i){const d=h.POSITION!==void 0?t.getDependency("accessor",h.POSITION):n.attributes.position;o.push(d)}if(s){const d=h.NORMAL!==void 0?t.getDependency("accessor",h.NORMAL):n.attributes.normal;a.push(d)}if(r){const d=h.COLOR_0!==void 0?t.getDependency("accessor",h.COLOR_0):n.attributes.color;l.push(d)}}return Promise.all([Promise.all(o),Promise.all(a),Promise.all(l)]).then(function(c){const u=c[0],h=c[1],d=c[2];return i&&(n.morphAttributes.position=u),s&&(n.morphAttributes.normal=h),r&&(n.morphAttributes.color=d),n.morphTargetsRelative=!0,n})}function bw(n,e){if(n.updateMorphTargets(),e.weights!==void 0)for(let t=0,i=e.weights.length;t<i;t++)n.morphTargetInfluences[t]=e.weights[t];if(e.extras&&Array.isArray(e.extras.targetNames)){const t=e.extras.targetNames;if(n.morphTargetInfluences.length===t.length){n.morphTargetDictionary={};for(let i=0,s=t.length;i<s;i++)n.morphTargetDictionary[t[i]]=i}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function yw(n){let e;const t=n.extensions&&n.extensions[rt.KHR_DRACO_MESH_COMPRESSION];if(t?e="draco:"+t.bufferView+":"+t.indices+":"+eu(t.attributes):e=n.indices+":"+eu(n.attributes)+":"+n.mode,n.targets!==void 0)for(let i=0,s=n.targets.length;i<s;i++)e+=":"+eu(n.targets[i]);return e}function eu(n){let e="";const t=Object.keys(n).sort();for(let i=0,s=t.length;i<s;i++)e+=t[i]+":"+n[t[i]]+";";return e}function oh(n){switch(n){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function Mw(n){return n.search(/\.jpe?g($|\?)/i)>0||n.search(/^data\:image\/jpeg/)===0?"image/jpeg":n.search(/\.webp($|\?)/i)>0||n.search(/^data\:image\/webp/)===0?"image/webp":n.search(/\.ktx2($|\?)/i)>0||n.search(/^data\:image\/ktx2/)===0?"image/ktx2":"image/png"}const Sw=new Qe;class ww{constructor(e={},t={}){this.json=e,this.extensions={},this.plugins={},this.options=t,this.cache=new YS,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let i=!1,s=-1,r=!1,o=-1;if(typeof navigator<"u"){const a=navigator.userAgent;i=/^((?!chrome|android).)*safari/i.test(a)===!0;const l=a.match(/Version\/(\d+)/);s=i&&l?parseInt(l[1],10):-1,r=a.indexOf("Firefox")>-1,o=r?a.match(/Firefox\/([0-9]+)\./)[1]:-1}typeof createImageBitmap>"u"||i&&s<17||r&&o<98?this.textureLoader=new Sv(this.options.manager):this.textureLoader=new Lv(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new Lo(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}setExtensions(e){this.extensions=e}setPlugins(e){this.plugins=e}parse(e,t){const i=this,s=this.json,r=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(o){return o._markDefs&&o._markDefs()}),Promise.all(this._invokeAll(function(o){return o.beforeRoot&&o.beforeRoot()})).then(function(){return Promise.all([i.getDependencies("scene"),i.getDependencies("animation"),i.getDependencies("camera")])}).then(function(o){const a={scene:o[0][s.scene||0],scenes:o[0],animations:o[1],cameras:o[2],asset:s.asset,parser:i,userData:{}};return $i(r,a,s),$n(a,s),Promise.all(i._invokeAll(function(l){return l.afterRoot&&l.afterRoot(a)})).then(function(){for(const l of a.scenes)l.updateMatrixWorld();e(a)})}).catch(t)}_markDefs(){const e=this.json.nodes||[],t=this.json.skins||[],i=this.json.meshes||[];for(let s=0,r=t.length;s<r;s++){const o=t[s].joints;for(let a=0,l=o.length;a<l;a++)e[o[a]].isBone=!0}for(let s=0,r=e.length;s<r;s++){const o=e[s];o.mesh!==void 0&&(this._addNodeRef(this.meshCache,o.mesh),o.skin!==void 0&&(i[o.mesh].isSkinnedMesh=!0)),o.camera!==void 0&&this._addNodeRef(this.cameraCache,o.camera)}}_addNodeRef(e,t){t!==void 0&&(e.refs[t]===void 0&&(e.refs[t]=e.uses[t]=0),e.refs[t]++)}_getNodeRef(e,t,i){if(e.refs[t]<=1)return i;const s=i.clone(),r=(o,a)=>{const l=this.associations.get(o);l!=null&&this.associations.set(a,l);for(const[c,u]of o.children.entries())r(u,a.children[c])};return r(i,s),s.name+="_instance_"+e.uses[t]++,s}_invokeOne(e){const t=Object.values(this.plugins);t.push(this);for(let i=0;i<t.length;i++){const s=e(t[i]);if(s)return s}return null}_invokeAll(e){const t=Object.values(this.plugins);t.unshift(this);const i=[];for(let s=0;s<t.length;s++){const r=e(t[s]);r&&i.push(r)}return i}getDependency(e,t){const i=e+":"+t;let s=this.cache.get(i);if(!s){switch(e){case"scene":s=this.loadScene(t);break;case"node":s=this._invokeOne(function(r){return r.loadNode&&r.loadNode(t)});break;case"mesh":s=this._invokeOne(function(r){return r.loadMesh&&r.loadMesh(t)});break;case"accessor":s=this.loadAccessor(t);break;case"bufferView":s=this._invokeOne(function(r){return r.loadBufferView&&r.loadBufferView(t)});break;case"buffer":s=this.loadBuffer(t);break;case"material":s=this._invokeOne(function(r){return r.loadMaterial&&r.loadMaterial(t)});break;case"texture":s=this._invokeOne(function(r){return r.loadTexture&&r.loadTexture(t)});break;case"skin":s=this.loadSkin(t);break;case"animation":s=this._invokeOne(function(r){return r.loadAnimation&&r.loadAnimation(t)});break;case"camera":s=this.loadCamera(t);break;default:if(s=this._invokeOne(function(r){return r!=this&&r.getDependency&&r.getDependency(e,t)}),!s)throw new Error("Unknown type: "+e);break}this.cache.add(i,s)}return s}getDependencies(e){let t=this.cache.get(e);if(!t){const i=this,s=this.json[e+(e==="mesh"?"es":"s")]||[];t=Promise.all(s.map(function(r,o){return i.getDependency(e,o)})),this.cache.add(e,t)}return t}loadBuffer(e){const t=this.json.buffers[e],i=this.fileLoader;if(t.type&&t.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(t.uri===void 0&&e===0)return Promise.resolve(this.extensions[rt.KHR_BINARY_GLTF].body);const s=this.options;return new Promise(function(r,o){i.load(Do.resolveURL(t.uri,s.path),r,void 0,function(){o(new Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}loadBufferView(e){const t=this.json.bufferViews[e];return this.getDependency("buffer",t.buffer).then(function(i){const s=t.byteLength||0,r=t.byteOffset||0;return i.slice(r,r+s)})}loadAccessor(e){const t=this,i=this.json,s=this.json.accessors[e];if(s.bufferView===void 0&&s.sparse===void 0){const o=Zc[s.type],a=Sr[s.componentType],l=s.normalized===!0,c=new a(s.count*o);return Promise.resolve(new it(c,o,l))}const r=[];return s.bufferView!==void 0?r.push(this.getDependency("bufferView",s.bufferView)):r.push(null),s.sparse!==void 0&&(r.push(this.getDependency("bufferView",s.sparse.indices.bufferView)),r.push(this.getDependency("bufferView",s.sparse.values.bufferView))),Promise.all(r).then(function(o){const a=o[0],l=Zc[s.type],c=Sr[s.componentType],u=c.BYTES_PER_ELEMENT,h=u*l,d=s.byteOffset||0,f=s.bufferView!==void 0?i.bufferViews[s.bufferView].byteStride:void 0,A=s.normalized===!0;let g,m;if(f&&f!==h){const p=Math.floor(d/f),E="InterleavedBuffer:"+s.bufferView+":"+s.componentType+":"+p+":"+s.count;let v=t.cache.get(E);v||(g=new c(a,p*f,s.count*f/u),v=new zl(g,f/u),t.cache.add(E,v)),m=new Ms(v,l,d%f/u,A)}else a===null?g=new c(s.count*l):g=new c(a,d,s.count*l),m=new it(g,l,A);if(s.sparse!==void 0){const p=Zc.SCALAR,E=Sr[s.sparse.indices.componentType],v=s.sparse.indices.byteOffset||0,_=s.sparse.values.byteOffset||0,x=new E(o[1],v,s.sparse.count*p),S=new c(o[2],_,s.sparse.count*l);a!==null&&(m=new it(m.array.slice(),m.itemSize,m.normalized)),m.normalized=!1;for(let I=0,L=x.length;I<L;I++){const y=x[I];if(m.setX(y,S[I*l]),l>=2&&m.setY(y,S[I*l+1]),l>=3&&m.setZ(y,S[I*l+2]),l>=4&&m.setW(y,S[I*l+3]),l>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}m.normalized=A}return m})}loadTexture(e){const t=this.json,i=this.options,r=t.textures[e].source,o=t.images[r];let a=this.textureLoader;if(o.uri){const l=i.manager.getHandler(o.uri);l!==null&&(a=l)}return this.loadTextureImage(e,r,a)}loadTextureImage(e,t,i){const s=this,r=this.json,o=r.textures[e],a=r.images[t],l=(a.uri||a.bufferView)+":"+o.sampler;if(this.textureCache[l])return this.textureCache[l];const c=this.loadImageSource(t,i).then(function(u){u.flipY=!1,u.name=o.name||a.name||"",u.name===""&&typeof a.uri=="string"&&a.uri.startsWith("data:image/")===!1&&(u.name=a.uri);const d=(r.samplers||{})[o.sampler]||{};return u.magFilter=ip[d.magFilter]||Jt,u.minFilter=ip[d.minFilter]||Gn,u.wrapS=sp[d.wrapS]||Es,u.wrapT=sp[d.wrapT]||Es,u.generateMipmaps=!u.isCompressedTexture&&u.minFilter!==Gt&&u.minFilter!==Jt,s.associations.set(u,{textures:e}),u}).catch(function(){return null});return this.textureCache[l]=c,c}loadImageSource(e,t){const i=this,s=this.json,r=this.options;if(this.sourceCache[e]!==void 0)return this.sourceCache[e].then(h=>h.clone());const o=s.images[e],a=self.URL||self.webkitURL;let l=o.uri||"",c=!1;if(o.bufferView!==void 0)l=i.getDependency("bufferView",o.bufferView).then(function(h){c=!0;const d=new Blob([h],{type:o.mimeType});return l=a.createObjectURL(d),l});else if(o.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+e+" is missing URI and bufferView");const u=Promise.resolve(l).then(function(h){return new Promise(function(d,f){let A=d;t.isImageBitmapLoader===!0&&(A=function(g){const m=new Qt(g);m.needsUpdate=!0,d(m)}),t.load(Do.resolveURL(h,r.path),A,void 0,f)})}).then(function(h){return c===!0&&a.revokeObjectURL(l),$n(h,o),h.userData.mimeType=o.mimeType||Mw(o.uri),h}).catch(function(h){throw console.error("THREE.GLTFLoader: Couldn't load texture",l),h});return this.sourceCache[e]=u,u}assignTexture(e,t,i,s){const r=this;return this.getDependency("texture",i.index).then(function(o){if(!o)return null;if(i.texCoord!==void 0&&i.texCoord>0&&(o=o.clone(),o.channel=i.texCoord),r.extensions[rt.KHR_TEXTURE_TRANSFORM]){const a=i.extensions!==void 0?i.extensions[rt.KHR_TEXTURE_TRANSFORM]:void 0;if(a){const l=r.associations.get(o);o=r.extensions[rt.KHR_TEXTURE_TRANSFORM].extendTexture(o,a),r.associations.set(o,l)}}return s!==void 0&&(o.colorSpace=s),e[t]=o,o})}assignFinalMaterial(e){const t=e.geometry;let i=e.material;const s=t.attributes.tangent===void 0,r=t.attributes.color!==void 0,o=t.attributes.normal===void 0;if(e.isPoints){const a="PointsMaterial:"+i.uuid;let l=this.cache.get(a);l||(l=new PA,An.prototype.copy.call(l,i),l.color.copy(i.color),l.map=i.map,l.sizeAttenuation=!1,this.cache.add(a,l)),i=l}else if(e.isLine){const a="LineBasicMaterial:"+i.uuid;let l=this.cache.get(a);l||(l=new Ts,An.prototype.copy.call(l,i),l.color.copy(i.color),l.map=i.map,this.cache.add(a,l)),i=l}if(s||r||o){let a="ClonedMaterial:"+i.uuid+":";s&&(a+="derivative-tangents:"),r&&(a+="vertex-colors:"),o&&(a+="flat-shading:");let l=this.cache.get(a);l||(l=i.clone(),r&&(l.vertexColors=!0),o&&(l.flatShading=!0),s&&(l.normalScale&&(l.normalScale.y*=-1),l.clearcoatNormalScale&&(l.clearcoatNormalScale.y*=-1)),this.cache.add(a,l),this.associations.set(l,this.associations.get(i))),i=l}e.material=i}getMaterialType(){return Nh}loadMaterial(e){const t=this,i=this.json,s=this.extensions,r=i.materials[e];let o;const a={},l=r.extensions||{},c=[];if(l[rt.KHR_MATERIALS_UNLIT]){const h=s[rt.KHR_MATERIALS_UNLIT];o=h.getMaterialType(),c.push(h.extendParams(a,r,t))}else{const h=r.pbrMetallicRoughness||{};if(a.color=new ye(1,1,1),a.opacity=1,Array.isArray(h.baseColorFactor)){const d=h.baseColorFactor;a.color.setRGB(d[0],d[1],d[2],rn),a.opacity=d[3]}h.baseColorTexture!==void 0&&c.push(t.assignTexture(a,"map",h.baseColorTexture,Bt)),a.metalness=h.metallicFactor!==void 0?h.metallicFactor:1,a.roughness=h.roughnessFactor!==void 0?h.roughnessFactor:1,h.metallicRoughnessTexture!==void 0&&(c.push(t.assignTexture(a,"metalnessMap",h.metallicRoughnessTexture)),c.push(t.assignTexture(a,"roughnessMap",h.metallicRoughnessTexture))),o=this._invokeOne(function(d){return d.getMaterialType&&d.getMaterialType(e)}),c.push(Promise.all(this._invokeAll(function(d){return d.extendMaterialParams&&d.extendMaterialParams(e,a)})))}r.doubleSided===!0&&(a.side=nn);const u=r.alphaMode||$c.OPAQUE;if(u===$c.BLEND?(a.transparent=!0,a.depthWrite=!1):(a.transparent=!1,u===$c.MASK&&(a.alphaTest=r.alphaCutoff!==void 0?r.alphaCutoff:.5)),r.normalTexture!==void 0&&o!==dn&&(c.push(t.assignTexture(a,"normalMap",r.normalTexture)),a.normalScale=new ce(1,1),r.normalTexture.scale!==void 0)){const h=r.normalTexture.scale;a.normalScale.set(h,h)}if(r.occlusionTexture!==void 0&&o!==dn&&(c.push(t.assignTexture(a,"aoMap",r.occlusionTexture)),r.occlusionTexture.strength!==void 0&&(a.aoMapIntensity=r.occlusionTexture.strength)),r.emissiveFactor!==void 0&&o!==dn){const h=r.emissiveFactor;a.emissive=new ye().setRGB(h[0],h[1],h[2],rn)}return r.emissiveTexture!==void 0&&o!==dn&&c.push(t.assignTexture(a,"emissiveMap",r.emissiveTexture,Bt)),Promise.all(c).then(function(){const h=new o(a);return r.name&&(h.name=r.name),$n(h,r),t.associations.set(h,{materials:e}),r.extensions&&$i(s,h,r),h})}createUniqueName(e){const t=_t.sanitizeNodeName(e||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(e){const t=this,i=this.extensions,s=this.primitiveCache;function r(a){return i[rt.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(a,t).then(function(l){return rp(l,a,t)})}const o=[];for(let a=0,l=e.length;a<l;a++){const c=e[a],u=yw(c),h=s[u];if(h)o.push(h.promise);else{let d;c.extensions&&c.extensions[rt.KHR_DRACO_MESH_COMPRESSION]?d=r(c):d=rp(new mt,c,t),s[u]={primitive:c,promise:d},o.push(d)}}return Promise.all(o)}loadMesh(e){const t=this,i=this.json,s=this.extensions,r=i.meshes[e],o=r.primitives,a=[];for(let l=0,c=o.length;l<c;l++){const u=o[l].material===void 0?xw(this.cache):this.getDependency("material",o[l].material);a.push(u)}return a.push(t.loadGeometries(o)),Promise.all(a).then(function(l){const c=l.slice(0,l.length-1),u=l[l.length-1],h=[];for(let f=0,A=u.length;f<A;f++){const g=u[f],m=o[f];let p;const E=c[f];if(m.mode===Rn.TRIANGLES||m.mode===Rn.TRIANGLE_STRIP||m.mode===Rn.TRIANGLE_FAN||m.mode===void 0)p=r.isSkinnedMesh===!0?new LA(g,E):new Me(g,E),p.isSkinnedMesh===!0&&p.normalizeSkinWeights(),m.mode===Rn.TRIANGLE_STRIP?p.geometry=tp(p.geometry,gA):m.mode===Rn.TRIANGLE_FAN&&(p.geometry=tp(p.geometry,ju));else if(m.mode===Rn.LINES)p=new ia(g,E);else if(m.mode===Rn.LINE_STRIP)p=new Wl(g,E);else if(m.mode===Rn.LINE_LOOP)p=new L_(g,E);else if(m.mode===Rn.POINTS)p=new UA(g,E);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+m.mode);Object.keys(p.geometry.morphAttributes).length>0&&bw(p,r),p.name=t.createUniqueName(r.name||"mesh_"+e),$n(p,r),m.extensions&&$i(s,p,m),t.assignFinalMaterial(p),h.push(p)}for(let f=0,A=h.length;f<A;f++)t.associations.set(h[f],{meshes:e,primitives:f});if(h.length===1)return r.extensions&&$i(s,h[0],r),h[0];const d=new Ct;r.extensions&&$i(s,d,r),t.associations.set(d,{meshes:e});for(let f=0,A=h.length;f<A;f++)d.add(h[f]);return d})}loadCamera(e){let t;const i=this.json.cameras[e],s=i[i.type];if(!s){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return i.type==="perspective"?t=new hn(wt.radToDeg(s.yfov),s.aspectRatio||1,s.znear||1,s.zfar||2e6):i.type==="orthographic"&&(t=new Qh(-s.xmag,s.xmag,s.ymag,-s.ymag,s.znear,s.zfar)),i.name&&(t.name=this.createUniqueName(i.name)),$n(t,i),Promise.resolve(t)}loadSkin(e){const t=this.json.skins[e],i=[];for(let s=0,r=t.joints.length;s<r;s++)i.push(this._loadNodeShallow(t.joints[s]));return t.inverseBindMatrices!==void 0?i.push(this.getDependency("accessor",t.inverseBindMatrices)):i.push(null),Promise.all(i).then(function(s){const r=s.pop(),o=s,a=[],l=[];for(let c=0,u=o.length;c<u;c++){const h=o[c];if(h){a.push(h);const d=new Qe;r!==null&&d.fromArray(r.array,c*16),l.push(d)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[c])}return new Hr(a,l)})}loadAnimation(e){const t=this.json,i=this,s=t.animations[e],r=s.name?s.name:"animation_"+e,o=[],a=[],l=[],c=[],u=[];for(let h=0,d=s.channels.length;h<d;h++){const f=s.channels[h],A=s.samplers[f.sampler],g=f.target,m=g.node,p=s.parameters!==void 0?s.parameters[A.input]:A.input,E=s.parameters!==void 0?s.parameters[A.output]:A.output;g.node!==void 0&&(o.push(this.getDependency("node",m)),a.push(this.getDependency("accessor",p)),l.push(this.getDependency("accessor",E)),c.push(A),u.push(g))}return Promise.all([Promise.all(o),Promise.all(a),Promise.all(l),Promise.all(c),Promise.all(u)]).then(function(h){const d=h[0],f=h[1],A=h[2],g=h[3],m=h[4],p=[];for(let v=0,_=d.length;v<_;v++){const x=d[v],S=f[v],I=A[v],L=g[v],y=m[v];if(x===void 0)continue;x.updateMatrix&&x.updateMatrix();const b=i._createAnimationTracks(x,S,I,L,y);if(b)for(let R=0;R<b.length;R++)p.push(b[R])}const E=new xv(r,void 0,p);return $n(E,s),E})}createNodeMesh(e){const t=this.json,i=this,s=t.nodes[e];return s.mesh===void 0?null:i.getDependency("mesh",s.mesh).then(function(r){const o=i._getNodeRef(i.meshCache,s.mesh,r);return s.weights!==void 0&&o.traverse(function(a){if(a.isMesh)for(let l=0,c=s.weights.length;l<c;l++)a.morphTargetInfluences[l]=s.weights[l]}),o})}loadNode(e){const t=this.json,i=this,s=t.nodes[e],r=i._loadNodeShallow(e),o=[],a=s.children||[];for(let c=0,u=a.length;c<u;c++)o.push(i.getDependency("node",a[c]));const l=s.skin===void 0?Promise.resolve(null):i.getDependency("skin",s.skin);return Promise.all([r,Promise.all(o),l]).then(function(c){const u=c[0],h=c[1],d=c[2];d!==null&&u.traverse(function(f){f.isSkinnedMesh&&f.bind(d,Sw)});for(let f=0,A=h.length;f<A;f++)u.add(h[f]);return u})}_loadNodeShallow(e){const t=this.json,i=this.extensions,s=this;if(this.nodeCache[e]!==void 0)return this.nodeCache[e];const r=t.nodes[e],o=r.name?s.createUniqueName(r.name):"",a=[],l=s._invokeOne(function(c){return c.createNodeMesh&&c.createNodeMesh(e)});return l&&a.push(l),r.camera!==void 0&&a.push(s.getDependency("camera",r.camera).then(function(c){return s._getNodeRef(s.cameraCache,r.camera,c)})),s._invokeAll(function(c){return c.createNodeAttachment&&c.createNodeAttachment(e)}).forEach(function(c){a.push(c)}),this.nodeCache[e]=Promise.all(a).then(function(c){let u;if(r.isBone===!0?u=new DA:c.length>1?u=new Ct:c.length===1?u=c[0]:u=new vt,u!==c[0])for(let h=0,d=c.length;h<d;h++)u.add(c[h]);if(r.name&&(u.userData.name=r.name,u.name=o),$n(u,r),r.extensions&&$i(i,u,r),r.matrix!==void 0){const h=new Qe;h.fromArray(r.matrix),u.applyMatrix4(h)}else r.translation!==void 0&&u.position.fromArray(r.translation),r.rotation!==void 0&&u.quaternion.fromArray(r.rotation),r.scale!==void 0&&u.scale.fromArray(r.scale);if(!s.associations.has(u))s.associations.set(u,{});else if(r.mesh!==void 0&&s.meshCache.refs[r.mesh]>1){const h=s.associations.get(u);s.associations.set(u,{...h})}return s.associations.get(u).nodes=e,u}),this.nodeCache[e]}loadScene(e){const t=this.extensions,i=this.json.scenes[e],s=this,r=new Ct;i.name&&(r.name=s.createUniqueName(i.name)),$n(r,i),i.extensions&&$i(t,r,i);const o=i.nodes||[],a=[];for(let l=0,c=o.length;l<c;l++)a.push(s.getDependency("node",o[l]));return Promise.all(a).then(function(l){for(let u=0,h=l.length;u<h;u++)r.add(l[u]);const c=u=>{const h=new Map;for(const[d,f]of s.associations)(d instanceof An||d instanceof Qt)&&h.set(d,f);return u.traverse(d=>{const f=s.associations.get(d);f!=null&&h.set(d,f)}),h};return s.associations=c(r),r})}_createAnimationTracks(e,t,i,s,r){const o=[],a=e.name?e.name:e.uuid,l=[];Fi[r.path]===Fi.weights?e.traverse(function(d){d.morphTargetInfluences&&l.push(d.name?d.name:d.uuid)}):l.push(a);let c;switch(Fi[r.path]){case Fi.weights:c=Pr;break;case Fi.rotation:c=Ur;break;case Fi.translation:case Fi.scale:c=Fr;break;default:switch(i.itemSize){case 1:c=Pr;break;case 2:case 3:default:c=Fr;break}break}const u=s.interpolation!==void 0?vw[s.interpolation]:qo,h=this._getArrayFromAccessor(i);for(let d=0,f=l.length;d<f;d++){const A=new c(l[d]+"."+Fi[r.path],t.array,h,u);s.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(A),o.push(A)}return o}_getArrayFromAccessor(e){let t=e.array;if(e.normalized){const i=oh(t.constructor),s=new Float32Array(t.length);for(let r=0,o=t.length;r<o;r++)s[r]=t[r]*i;t=s}return t}_createCubicSplineTrackInterpolant(e){e.createInterpolant=function(i){const s=this instanceof Ur?_w:Sm;return new s(this.times,this.values,this.getValueSize()/3,i)},e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}}function Cw(n,e,t){const i=e.attributes,s=new oi;if(i.POSITION!==void 0){const a=t.json.accessors[i.POSITION],l=a.min,c=a.max;if(l!==void 0&&c!==void 0){if(s.set(new w(l[0],l[1],l[2]),new w(c[0],c[1],c[2])),a.normalized){const u=oh(Sr[a.componentType]);s.min.multiplyScalar(u),s.max.multiplyScalar(u)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;const r=e.targets;if(r!==void 0){const a=new w,l=new w;for(let c=0,u=r.length;c<u;c++){const h=r[c];if(h.POSITION!==void 0){const d=t.json.accessors[h.POSITION],f=d.min,A=d.max;if(f!==void 0&&A!==void 0){if(l.setX(Math.max(Math.abs(f[0]),Math.abs(A[0]))),l.setY(Math.max(Math.abs(f[1]),Math.abs(A[1]))),l.setZ(Math.max(Math.abs(f[2]),Math.abs(A[2]))),d.normalized){const g=oh(Sr[d.componentType]);l.multiplyScalar(g)}a.max(l)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}s.expandByVector(a)}n.boundingBox=s;const o=new ai;s.getCenter(o.center),o.radius=s.min.distanceTo(s.max)/2,n.boundingSphere=o}function rp(n,e,t){const i=e.attributes,s=[];function r(o,a){return t.getDependency("accessor",o).then(function(l){n.setAttribute(a,l)})}for(const o in i){const a=rh[o]||o.toLowerCase();a in n.attributes||s.push(r(i[o],a))}if(e.indices!==void 0&&!n.index){const o=t.getDependency("accessor",e.indices).then(function(a){n.setIndex(a)});s.push(o)}return lt.workingColorSpace!==rn&&"COLOR_0"in i&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${lt.workingColorSpace}" not supported.`),$n(n,e),Cw(n,e,t),Promise.all(s).then(function(){return e.targets!==void 0?Ew(n,e.targets,t):n})}class Iw{constructor(e=4){this.pool=e,this.queue=[],this.workers=[],this.workersResolve=[],this.workerStatus=0,this.workerCreator=null}_initWorker(e){if(!this.workers[e]){const t=this.workerCreator();t.addEventListener("message",this._onMessage.bind(this,e)),this.workers[e]=t}}_getIdleWorker(){for(let e=0;e<this.pool;e++)if(!(this.workerStatus&1<<e))return e;return-1}_onMessage(e,t){const i=this.workersResolve[e];if(i&&i(t),this.queue.length){const{resolve:s,msg:r,transfer:o}=this.queue.shift();this.workersResolve[e]=s,this.workers[e].postMessage(r,o)}else this.workerStatus^=1<<e}setWorkerCreator(e){this.workerCreator=e}setWorkerLimit(e){this.pool=e}postMessage(e,t){return new Promise(i=>{const s=this._getIdleWorker();s!==-1?(this._initWorker(s),this.workerStatus|=1<<s,this.workersResolve[s]=i,this.workers[s].postMessage(e,t)):this.queue.push({resolve:i,msg:e,transfer:t})})}dispose(){this.workers.forEach(e=>e.terminate()),this.workersResolve.length=0,this.workers.length=0,this.queue.length=0,this.workerStatus=0}}const Tw=0,op=2,Rw=1,ap=2,Bw=0,Lw=1,Dw=10,Pw=0,wm=9,Cm=15,Im=16,Tm=22,Rm=37,Bm=43,Lm=76,Dm=83,Pm=97,Um=100,Fm=103,Nm=109,Om=122,km=123,Qm=131,Hm=132,Gm=133,zm=134,Vm=137,Wm=138,qm=139,Xm=140,Ym=141,jm=142,Jm=145,Km=146,Zm=148,$m=152,eg=157,tg=158,ng=165,ig=166,sg=1000054e3,rg=1000054001,og=1000054004,ag=1000054005,Kh=1000066e3,lg=1000066004;class ho{constructor(e,t,i,s){this._dataView=void 0,this._littleEndian=void 0,this._offset=void 0,this._dataView=new DataView(e.buffer,e.byteOffset+t,i),this._littleEndian=s,this._offset=0}_nextUint8(){const e=this._dataView.getUint8(this._offset);return this._offset+=1,e}_nextUint16(){const e=this._dataView.getUint16(this._offset,this._littleEndian);return this._offset+=2,e}_nextUint32(){const e=this._dataView.getUint32(this._offset,this._littleEndian);return this._offset+=4,e}_nextUint64(){const e=this._dataView.getUint32(this._offset,this._littleEndian)+4294967296*this._dataView.getUint32(this._offset+4,this._littleEndian);return this._offset+=8,e}_nextInt32(){const e=this._dataView.getInt32(this._offset,this._littleEndian);return this._offset+=4,e}_nextUint8Array(e){const t=new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+this._offset,e);return this._offset+=e,t}_skip(e){return this._offset+=e,this}_scan(e,t=0){const i=this._offset;let s=0;for(;this._dataView.getUint8(this._offset)!==t&&s<e;)s++,this._offset++;return s<e&&this._offset++,new Uint8Array(this._dataView.buffer,this._dataView.byteOffset+i,s)}}const ln=[171,75,84,88,32,50,48,187,13,10,26,10];function lp(n){return new TextDecoder().decode(n)}function Uw(n){const e=new Uint8Array(n.buffer,n.byteOffset,ln.length);if(e[0]!==ln[0]||e[1]!==ln[1]||e[2]!==ln[2]||e[3]!==ln[3]||e[4]!==ln[4]||e[5]!==ln[5]||e[6]!==ln[6]||e[7]!==ln[7]||e[8]!==ln[8]||e[9]!==ln[9]||e[10]!==ln[10]||e[11]!==ln[11])throw new Error("Missing KTX 2.0 identifier.");const t={vkFormat:0,typeSize:1,pixelWidth:0,pixelHeight:0,pixelDepth:0,layerCount:0,faceCount:1,levelCount:0,supercompressionScheme:0,levels:[],dataFormatDescriptor:[{vendorId:0,descriptorType:0,versionNumber:2,colorModel:0,colorPrimaries:1,transferFunction:2,flags:0,texelBlockDimension:[0,0,0,0],bytesPlane:[0,0,0,0,0,0,0,0],samples:[]}],keyValue:{},globalData:null},i=17*Uint32Array.BYTES_PER_ELEMENT,s=new ho(n,ln.length,i,!0);t.vkFormat=s._nextUint32(),t.typeSize=s._nextUint32(),t.pixelWidth=s._nextUint32(),t.pixelHeight=s._nextUint32(),t.pixelDepth=s._nextUint32(),t.layerCount=s._nextUint32(),t.faceCount=s._nextUint32(),t.levelCount=s._nextUint32(),t.supercompressionScheme=s._nextUint32();const r=s._nextUint32(),o=s._nextUint32(),a=s._nextUint32(),l=s._nextUint32(),c=s._nextUint64(),u=s._nextUint64(),h=3*Math.max(t.levelCount,1)*8,d=new ho(n,ln.length+i,h,!0);for(let ae=0,ve=Math.max(t.levelCount,1);ae<ve;ae++)t.levels.push({levelData:new Uint8Array(n.buffer,n.byteOffset+d._nextUint64(),d._nextUint64()),uncompressedByteLength:d._nextUint64()});const f=new ho(n,r,o,!0);f._skip(4);const A=f._nextUint16(),g=f._nextUint16(),m=f._nextUint16(),p=f._nextUint16(),E={vendorId:A,descriptorType:g,versionNumber:m,colorModel:f._nextUint8(),colorPrimaries:f._nextUint8(),transferFunction:f._nextUint8(),flags:f._nextUint8(),texelBlockDimension:[f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8()],bytesPlane:[f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8()],samples:[]},v=(p/4-6)/4;for(let ae=0;ae<v;ae++){const ve={bitOffset:f._nextUint16(),bitLength:f._nextUint8(),channelType:f._nextUint8(),samplePosition:[f._nextUint8(),f._nextUint8(),f._nextUint8(),f._nextUint8()],sampleLower:Number.NEGATIVE_INFINITY,sampleUpper:Number.POSITIVE_INFINITY};64&ve.channelType?(ve.sampleLower=f._nextInt32(),ve.sampleUpper=f._nextInt32()):(ve.sampleLower=f._nextUint32(),ve.sampleUpper=f._nextUint32()),E.samples[ae]=ve}t.dataFormatDescriptor.length=0,t.dataFormatDescriptor.push(E);const _=new ho(n,a,l,!0);for(;_._offset<l;){const ae=_._nextUint32(),ve=_._scan(ae),Oe=lp(ve);if(t.keyValue[Oe]=_._nextUint8Array(ae-ve.byteLength-1),Oe.match(/^ktx/i)){const Ke=lp(t.keyValue[Oe]);t.keyValue[Oe]=Ke.substring(0,Ke.lastIndexOf("\0"))}_._skip(ae%4?4-ae%4:0)}if(u<=0)return t;const x=new ho(n,c,u,!0),S=x._nextUint16(),I=x._nextUint16(),L=x._nextUint32(),y=x._nextUint32(),b=x._nextUint32(),R=x._nextUint32(),U=[];for(let ae=0,ve=Math.max(t.levelCount,1);ae<ve;ae++)U.push({imageFlags:x._nextUint32(),rgbSliceByteOffset:x._nextUint32(),rgbSliceByteLength:x._nextUint32(),alphaSliceByteOffset:x._nextUint32(),alphaSliceByteLength:x._nextUint32()});const N=c+x._offset,G=N+L,V=G+y,P=V+b,Y=new Uint8Array(n.buffer,n.byteOffset+N,L),H=new Uint8Array(n.buffer,n.byteOffset+G,y),te=new Uint8Array(n.buffer,n.byteOffset+V,b),se=new Uint8Array(n.buffer,n.byteOffset+P,R);return t.globalData={endpointCount:S,selectorCount:I,imageDescs:U,endpointsData:Y,selectorsData:H,tablesData:te,extendedData:se},t}let tu,_i,ah;const nu={env:{emscripten_notify_memory_growth:function(n){ah=new Uint8Array(_i.exports.memory.buffer)}}};class Fw{init(){return tu||(tu=typeof fetch<"u"?fetch("data:application/wasm;base64,"+cp).then(e=>e.arrayBuffer()).then(e=>WebAssembly.instantiate(e,nu)).then(this._init):WebAssembly.instantiate(Buffer.from(cp,"base64"),nu).then(this._init),tu)}_init(e){_i=e.instance,nu.env.emscripten_notify_memory_growth(0)}decode(e,t=0){if(!_i)throw new Error("ZSTDDecoder: Await .init() before decoding.");const i=e.byteLength,s=_i.exports.malloc(i);ah.set(e,s),t=t||Number(_i.exports.ZSTD_findDecompressedSize(s,i));const r=_i.exports.malloc(t),o=_i.exports.ZSTD_decompress(r,t,s,i),a=ah.slice(r,r+o);return _i.exports.free(s),_i.exports.free(r),a}}const cp="AGFzbQEAAAABpQEVYAF/AX9gAn9/AGADf39/AX9gBX9/f39/AX9gAX8AYAJ/fwF/YAR/f39/AX9gA39/fwBgBn9/f39/fwF/YAd/f39/f39/AX9gAn9/AX5gAn5+AX5gAABgBX9/f39/AGAGf39/f39/AGAIf39/f39/f38AYAl/f39/f39/f38AYAABf2AIf39/f39/f38Bf2ANf39/f39/f39/f39/fwF/YAF/AX4CJwEDZW52H2Vtc2NyaXB0ZW5fbm90aWZ5X21lbW9yeV9ncm93dGgABANpaAEFAAAFAgEFCwACAQABAgIFBQcAAwABDgsBAQcAEhMHAAUBDAQEAAANBwQCAgYCBAgDAwMDBgEACQkHBgICAAYGAgQUBwYGAwIGAAMCAQgBBwUGCgoEEQAEBAEIAwgDBQgDEA8IAAcABAUBcAECAgUEAQCAAgYJAX8BQaCgwAILB2AHBm1lbW9yeQIABm1hbGxvYwAoBGZyZWUAJgxaU1REX2lzRXJyb3IAaBlaU1REX2ZpbmREZWNvbXByZXNzZWRTaXplAFQPWlNURF9kZWNvbXByZXNzAEoGX3N0YXJ0ACQJBwEAQQELASQKussBaA8AIAAgACgCBCABajYCBAsZACAAKAIAIAAoAgRBH3F0QQAgAWtBH3F2CwgAIABBiH9LC34BBH9BAyEBIAAoAgQiA0EgTQRAIAAoAggiASAAKAIQTwRAIAAQDQ8LIAAoAgwiAiABRgRAQQFBAiADQSBJGw8LIAAgASABIAJrIANBA3YiBCABIARrIAJJIgEbIgJrIgQ2AgggACADIAJBA3RrNgIEIAAgBCgAADYCAAsgAQsUAQF/IAAgARACIQIgACABEAEgAgv3AQECfyACRQRAIABCADcCACAAQQA2AhAgAEIANwIIQbh/DwsgACABNgIMIAAgAUEEajYCECACQQRPBEAgACABIAJqIgFBfGoiAzYCCCAAIAMoAAA2AgAgAUF/ai0AACIBBEAgAEEIIAEQFGs2AgQgAg8LIABBADYCBEF/DwsgACABNgIIIAAgAS0AACIDNgIAIAJBfmoiBEEBTQRAIARBAWtFBEAgACABLQACQRB0IANyIgM2AgALIAAgAS0AAUEIdCADajYCAAsgASACakF/ai0AACIBRQRAIABBADYCBEFsDwsgAEEoIAEQFCACQQN0ams2AgQgAgsWACAAIAEpAAA3AAAgACABKQAINwAICy8BAX8gAUECdEGgHWooAgAgACgCAEEgIAEgACgCBGprQR9xdnEhAiAAIAEQASACCyEAIAFCz9bTvtLHq9lCfiAAfEIfiUKHla+vmLbem55/fgsdAQF/IAAoAgggACgCDEYEfyAAKAIEQSBGBUEACwuCBAEDfyACQYDAAE8EQCAAIAEgAhBnIAAPCyAAIAJqIQMCQCAAIAFzQQNxRQRAAkAgAkEBSARAIAAhAgwBCyAAQQNxRQRAIAAhAgwBCyAAIQIDQCACIAEtAAA6AAAgAUEBaiEBIAJBAWoiAiADTw0BIAJBA3ENAAsLAkAgA0F8cSIEQcAASQ0AIAIgBEFAaiIFSw0AA0AgAiABKAIANgIAIAIgASgCBDYCBCACIAEoAgg2AgggAiABKAIMNgIMIAIgASgCEDYCECACIAEoAhQ2AhQgAiABKAIYNgIYIAIgASgCHDYCHCACIAEoAiA2AiAgAiABKAIkNgIkIAIgASgCKDYCKCACIAEoAiw2AiwgAiABKAIwNgIwIAIgASgCNDYCNCACIAEoAjg2AjggAiABKAI8NgI8IAFBQGshASACQUBrIgIgBU0NAAsLIAIgBE8NAQNAIAIgASgCADYCACABQQRqIQEgAkEEaiICIARJDQALDAELIANBBEkEQCAAIQIMAQsgA0F8aiIEIABJBEAgACECDAELIAAhAgNAIAIgAS0AADoAACACIAEtAAE6AAEgAiABLQACOgACIAIgAS0AAzoAAyABQQRqIQEgAkEEaiICIARNDQALCyACIANJBEADQCACIAEtAAA6AAAgAUEBaiEBIAJBAWoiAiADRw0ACwsgAAsMACAAIAEpAAA3AAALQQECfyAAKAIIIgEgACgCEEkEQEEDDwsgACAAKAIEIgJBB3E2AgQgACABIAJBA3ZrIgE2AgggACABKAAANgIAQQALDAAgACABKAIANgAAC/cCAQJ/AkAgACABRg0AAkAgASACaiAASwRAIAAgAmoiBCABSw0BCyAAIAEgAhALDwsgACABc0EDcSEDAkACQCAAIAFJBEAgAwRAIAAhAwwDCyAAQQNxRQRAIAAhAwwCCyAAIQMDQCACRQ0EIAMgAS0AADoAACABQQFqIQEgAkF/aiECIANBAWoiA0EDcQ0ACwwBCwJAIAMNACAEQQNxBEADQCACRQ0FIAAgAkF/aiICaiIDIAEgAmotAAA6AAAgA0EDcQ0ACwsgAkEDTQ0AA0AgACACQXxqIgJqIAEgAmooAgA2AgAgAkEDSw0ACwsgAkUNAgNAIAAgAkF/aiICaiABIAJqLQAAOgAAIAINAAsMAgsgAkEDTQ0AIAIhBANAIAMgASgCADYCACABQQRqIQEgA0EEaiEDIARBfGoiBEEDSw0ACyACQQNxIQILIAJFDQADQCADIAEtAAA6AAAgA0EBaiEDIAFBAWohASACQX9qIgINAAsLIAAL8wICAn8BfgJAIAJFDQAgACACaiIDQX9qIAE6AAAgACABOgAAIAJBA0kNACADQX5qIAE6AAAgACABOgABIANBfWogAToAACAAIAE6AAIgAkEHSQ0AIANBfGogAToAACAAIAE6AAMgAkEJSQ0AIABBACAAa0EDcSIEaiIDIAFB/wFxQYGChAhsIgE2AgAgAyACIARrQXxxIgRqIgJBfGogATYCACAEQQlJDQAgAyABNgIIIAMgATYCBCACQXhqIAE2AgAgAkF0aiABNgIAIARBGUkNACADIAE2AhggAyABNgIUIAMgATYCECADIAE2AgwgAkFwaiABNgIAIAJBbGogATYCACACQWhqIAE2AgAgAkFkaiABNgIAIAQgA0EEcUEYciIEayICQSBJDQAgAa0iBUIghiAFhCEFIAMgBGohAQNAIAEgBTcDGCABIAU3AxAgASAFNwMIIAEgBTcDACABQSBqIQEgAkFgaiICQR9LDQALCyAACy8BAn8gACgCBCAAKAIAQQJ0aiICLQACIQMgACACLwEAIAEgAi0AAxAIajYCACADCy8BAn8gACgCBCAAKAIAQQJ0aiICLQACIQMgACACLwEAIAEgAi0AAxAFajYCACADCx8AIAAgASACKAIEEAg2AgAgARAEGiAAIAJBCGo2AgQLCAAgAGdBH3MLugUBDX8jAEEQayIKJAACfyAEQQNNBEAgCkEANgIMIApBDGogAyAEEAsaIAAgASACIApBDGpBBBAVIgBBbCAAEAMbIAAgACAESxsMAQsgAEEAIAEoAgBBAXRBAmoQECENQVQgAygAACIGQQ9xIgBBCksNABogAiAAQQVqNgIAIAMgBGoiAkF8aiEMIAJBeWohDiACQXtqIRAgAEEGaiELQQQhBSAGQQR2IQRBICAAdCIAQQFyIQkgASgCACEPQQAhAiADIQYCQANAIAlBAkggAiAPS3JFBEAgAiEHAkAgCARAA0AgBEH//wNxQf//A0YEQCAHQRhqIQcgBiAQSQR/IAZBAmoiBigAACAFdgUgBUEQaiEFIARBEHYLIQQMAQsLA0AgBEEDcSIIQQNGBEAgBUECaiEFIARBAnYhBCAHQQNqIQcMAQsLIAcgCGoiByAPSw0EIAVBAmohBQNAIAIgB0kEQCANIAJBAXRqQQA7AQAgAkEBaiECDAELCyAGIA5LQQAgBiAFQQN1aiIHIAxLG0UEQCAHKAAAIAVBB3EiBXYhBAwCCyAEQQJ2IQQLIAYhBwsCfyALQX9qIAQgAEF/anEiBiAAQQF0QX9qIgggCWsiEUkNABogBCAIcSIEQQAgESAEIABIG2shBiALCyEIIA0gAkEBdGogBkF/aiIEOwEAIAlBASAGayAEIAZBAUgbayEJA0AgCSAASARAIABBAXUhACALQX9qIQsMAQsLAn8gByAOS0EAIAcgBSAIaiIFQQN1aiIGIAxLG0UEQCAFQQdxDAELIAUgDCIGIAdrQQN0awshBSACQQFqIQIgBEUhCCAGKAAAIAVBH3F2IQQMAQsLQWwgCUEBRyAFQSBKcg0BGiABIAJBf2o2AgAgBiAFQQdqQQN1aiADawwBC0FQCyEAIApBEGokACAACwkAQQFBBSAAGwsMACAAIAEoAAA2AAALqgMBCn8jAEHwAGsiCiQAIAJBAWohDiAAQQhqIQtBgIAEIAVBf2p0QRB1IQxBACECQQEhBkEBIAV0IglBf2oiDyEIA0AgAiAORkUEQAJAIAEgAkEBdCINai8BACIHQf//A0YEQCALIAhBA3RqIAI2AgQgCEF/aiEIQQEhBwwBCyAGQQAgDCAHQRB0QRB1ShshBgsgCiANaiAHOwEAIAJBAWohAgwBCwsgACAFNgIEIAAgBjYCACAJQQN2IAlBAXZqQQNqIQxBACEAQQAhBkEAIQIDQCAGIA5GBEADQAJAIAAgCUYNACAKIAsgAEEDdGoiASgCBCIGQQF0aiICIAIvAQAiAkEBajsBACABIAUgAhAUayIIOgADIAEgAiAIQf8BcXQgCWs7AQAgASAEIAZBAnQiAmooAgA6AAIgASACIANqKAIANgIEIABBAWohAAwBCwsFIAEgBkEBdGouAQAhDUEAIQcDQCAHIA1ORQRAIAsgAkEDdGogBjYCBANAIAIgDGogD3EiAiAISw0ACyAHQQFqIQcMAQsLIAZBAWohBgwBCwsgCkHwAGokAAsjAEIAIAEQCSAAhUKHla+vmLbem55/fkLj3MqV/M7y9YV/fAsQACAAQn43AwggACABNgIACyQBAX8gAARAIAEoAgQiAgRAIAEoAgggACACEQEADwsgABAmCwsfACAAIAEgAi8BABAINgIAIAEQBBogACACQQRqNgIEC0oBAX9BoCAoAgAiASAAaiIAQX9MBEBBiCBBMDYCAEF/DwsCQCAAPwBBEHRNDQAgABBmDQBBiCBBMDYCAEF/DwtBoCAgADYCACABC9cBAQh/Qbp/IQoCQCACKAIEIgggAigCACIJaiIOIAEgAGtLDQBBbCEKIAkgBCADKAIAIgtrSw0AIAAgCWoiBCACKAIIIgxrIQ0gACABQWBqIg8gCyAJQQAQKSADIAkgC2o2AgACQAJAIAwgBCAFa00EQCANIQUMAQsgDCAEIAZrSw0CIAcgDSAFayIAaiIBIAhqIAdNBEAgBCABIAgQDxoMAgsgBCABQQAgAGsQDyEBIAIgACAIaiIINgIEIAEgAGshBAsgBCAPIAUgCEEBECkLIA4hCgsgCgubAgEBfyMAQYABayINJAAgDSADNgJ8AkAgAkEDSwRAQX8hCQwBCwJAAkACQAJAIAJBAWsOAwADAgELIAZFBEBBuH8hCQwEC0FsIQkgBS0AACICIANLDQMgACAHIAJBAnQiAmooAgAgAiAIaigCABA7IAEgADYCAEEBIQkMAwsgASAJNgIAQQAhCQwCCyAKRQRAQWwhCQwCC0EAIQkgC0UgDEEZSHINAUEIIAR0QQhqIQBBACECA0AgAiAATw0CIAJBQGshAgwAAAsAC0FsIQkgDSANQfwAaiANQfgAaiAFIAYQFSICEAMNACANKAJ4IgMgBEsNACAAIA0gDSgCfCAHIAggAxAYIAEgADYCACACIQkLIA1BgAFqJAAgCQsLACAAIAEgAhALGgsQACAALwAAIAAtAAJBEHRyCy8AAn9BuH8gAUEISQ0AGkFyIAAoAAQiAEF3Sw0AGkG4fyAAQQhqIgAgACABSxsLCwkAIAAgATsAAAsDAAELigYBBX8gACAAKAIAIgVBfnE2AgBBACAAIAVBAXZqQYQgKAIAIgQgAEYbIQECQAJAIAAoAgQiAkUNACACKAIAIgNBAXENACACQQhqIgUgA0EBdkF4aiIDQQggA0EISxtnQR9zQQJ0QYAfaiIDKAIARgRAIAMgAigCDDYCAAsgAigCCCIDBEAgAyACKAIMNgIECyACKAIMIgMEQCADIAIoAgg2AgALIAIgAigCACAAKAIAQX5xajYCAEGEICEAAkACQCABRQ0AIAEgAjYCBCABKAIAIgNBAXENASADQQF2QXhqIgNBCCADQQhLG2dBH3NBAnRBgB9qIgMoAgAgAUEIakYEQCADIAEoAgw2AgALIAEoAggiAwRAIAMgASgCDDYCBAsgASgCDCIDBEAgAyABKAIINgIAQYQgKAIAIQQLIAIgAigCACABKAIAQX5xajYCACABIARGDQAgASABKAIAQQF2akEEaiEACyAAIAI2AgALIAIoAgBBAXZBeGoiAEEIIABBCEsbZ0Efc0ECdEGAH2oiASgCACEAIAEgBTYCACACIAA2AgwgAkEANgIIIABFDQEgACAFNgIADwsCQCABRQ0AIAEoAgAiAkEBcQ0AIAJBAXZBeGoiAkEIIAJBCEsbZ0Efc0ECdEGAH2oiAigCACABQQhqRgRAIAIgASgCDDYCAAsgASgCCCICBEAgAiABKAIMNgIECyABKAIMIgIEQCACIAEoAgg2AgBBhCAoAgAhBAsgACAAKAIAIAEoAgBBfnFqIgI2AgACQCABIARHBEAgASABKAIAQQF2aiAANgIEIAAoAgAhAgwBC0GEICAANgIACyACQQF2QXhqIgFBCCABQQhLG2dBH3NBAnRBgB9qIgIoAgAhASACIABBCGoiAjYCACAAIAE2AgwgAEEANgIIIAFFDQEgASACNgIADwsgBUEBdkF4aiIBQQggAUEISxtnQR9zQQJ0QYAfaiICKAIAIQEgAiAAQQhqIgI2AgAgACABNgIMIABBADYCCCABRQ0AIAEgAjYCAAsLDgAgAARAIABBeGoQJQsLgAIBA38CQCAAQQ9qQXhxQYQgKAIAKAIAQQF2ayICEB1Bf0YNAAJAQYQgKAIAIgAoAgAiAUEBcQ0AIAFBAXZBeGoiAUEIIAFBCEsbZ0Efc0ECdEGAH2oiASgCACAAQQhqRgRAIAEgACgCDDYCAAsgACgCCCIBBEAgASAAKAIMNgIECyAAKAIMIgFFDQAgASAAKAIINgIAC0EBIQEgACAAKAIAIAJBAXRqIgI2AgAgAkEBcQ0AIAJBAXZBeGoiAkEIIAJBCEsbZ0Efc0ECdEGAH2oiAygCACECIAMgAEEIaiIDNgIAIAAgAjYCDCAAQQA2AgggAkUNACACIAM2AgALIAELtwIBA38CQAJAIABBASAAGyICEDgiAA0AAkACQEGEICgCACIARQ0AIAAoAgAiA0EBcQ0AIAAgA0EBcjYCACADQQF2QXhqIgFBCCABQQhLG2dBH3NBAnRBgB9qIgEoAgAgAEEIakYEQCABIAAoAgw2AgALIAAoAggiAQRAIAEgACgCDDYCBAsgACgCDCIBBEAgASAAKAIINgIACyACECchAkEAIQFBhCAoAgAhACACDQEgACAAKAIAQX5xNgIAQQAPCyACQQ9qQXhxIgMQHSICQX9GDQIgAkEHakF4cSIAIAJHBEAgACACaxAdQX9GDQMLAkBBhCAoAgAiAUUEQEGAICAANgIADAELIAAgATYCBAtBhCAgADYCACAAIANBAXRBAXI2AgAMAQsgAEUNAQsgAEEIaiEBCyABC7kDAQJ/IAAgA2ohBQJAIANBB0wEQANAIAAgBU8NAiAAIAItAAA6AAAgAEEBaiEAIAJBAWohAgwAAAsACyAEQQFGBEACQCAAIAJrIgZBB00EQCAAIAItAAA6AAAgACACLQABOgABIAAgAi0AAjoAAiAAIAItAAM6AAMgAEEEaiACIAZBAnQiBkHAHmooAgBqIgIQFyACIAZB4B5qKAIAayECDAELIAAgAhAMCyACQQhqIQIgAEEIaiEACwJAAkACQAJAIAUgAU0EQCAAIANqIQEgBEEBRyAAIAJrQQ9Kcg0BA0AgACACEAwgAkEIaiECIABBCGoiACABSQ0ACwwFCyAAIAFLBEAgACEBDAQLIARBAUcgACACa0EPSnINASAAIQMgAiEEA0AgAyAEEAwgBEEIaiEEIANBCGoiAyABSQ0ACwwCCwNAIAAgAhAHIAJBEGohAiAAQRBqIgAgAUkNAAsMAwsgACEDIAIhBANAIAMgBBAHIARBEGohBCADQRBqIgMgAUkNAAsLIAIgASAAa2ohAgsDQCABIAVPDQEgASACLQAAOgAAIAFBAWohASACQQFqIQIMAAALAAsLQQECfyAAIAAoArjgASIDNgLE4AEgACgCvOABIQQgACABNgK84AEgACABIAJqNgK44AEgACABIAQgA2tqNgLA4AELpgEBAX8gACAAKALs4QEQFjYCyOABIABCADcD+OABIABCADcDuOABIABBwOABakIANwMAIABBqNAAaiIBQYyAgOAANgIAIABBADYCmOIBIABCADcDiOEBIABCAzcDgOEBIABBrNABakHgEikCADcCACAAQbTQAWpB6BIoAgA2AgAgACABNgIMIAAgAEGYIGo2AgggACAAQaAwajYCBCAAIABBEGo2AgALYQEBf0G4fyEDAkAgAUEDSQ0AIAIgABAhIgFBA3YiADYCCCACIAFBAXE2AgQgAiABQQF2QQNxIgM2AgACQCADQX9qIgFBAksNAAJAIAFBAWsOAgEAAgtBbA8LIAAhAwsgAwsMACAAIAEgAkEAEC4LiAQCA38CfiADEBYhBCAAQQBBKBAQIQAgBCACSwRAIAQPCyABRQRAQX8PCwJAAkAgA0EBRg0AIAEoAAAiBkGo6r5pRg0AQXYhAyAGQXBxQdDUtMIBRw0BQQghAyACQQhJDQEgAEEAQSgQECEAIAEoAAQhASAAQQE2AhQgACABrTcDAEEADwsgASACIAMQLyIDIAJLDQAgACADNgIYQXIhAyABIARqIgVBf2otAAAiAkEIcQ0AIAJBIHEiBkUEQEFwIQMgBS0AACIFQacBSw0BIAVBB3GtQgEgBUEDdkEKaq2GIgdCA4h+IAd8IQggBEEBaiEECyACQQZ2IQMgAkECdiEFAkAgAkEDcUF/aiICQQJLBEBBACECDAELAkACQAJAIAJBAWsOAgECAAsgASAEai0AACECIARBAWohBAwCCyABIARqLwAAIQIgBEECaiEEDAELIAEgBGooAAAhAiAEQQRqIQQLIAVBAXEhBQJ+AkACQAJAIANBf2oiA0ECTQRAIANBAWsOAgIDAQtCfyAGRQ0DGiABIARqMQAADAMLIAEgBGovAACtQoACfAwCCyABIARqKAAArQwBCyABIARqKQAACyEHIAAgBTYCICAAIAI2AhwgACAHNwMAQQAhAyAAQQA2AhQgACAHIAggBhsiBzcDCCAAIAdCgIAIIAdCgIAIVBs+AhALIAMLWwEBf0G4fyEDIAIQFiICIAFNBH8gACACakF/ai0AACIAQQNxQQJ0QaAeaigCACACaiAAQQZ2IgFBAnRBsB5qKAIAaiAAQSBxIgBFaiABRSAAQQV2cWoFQbh/CwsdACAAKAKQ4gEQWiAAQQA2AqDiASAAQgA3A5DiAQu1AwEFfyMAQZACayIKJABBuH8hBgJAIAVFDQAgBCwAACIIQf8BcSEHAkAgCEF/TARAIAdBgn9qQQF2IgggBU8NAkFsIQYgB0GBf2oiBUGAAk8NAiAEQQFqIQdBACEGA0AgBiAFTwRAIAUhBiAIIQcMAwUgACAGaiAHIAZBAXZqIgQtAABBBHY6AAAgACAGQQFyaiAELQAAQQ9xOgAAIAZBAmohBgwBCwAACwALIAcgBU8NASAAIARBAWogByAKEFMiBhADDQELIAYhBEEAIQYgAUEAQTQQECEJQQAhBQNAIAQgBkcEQCAAIAZqIggtAAAiAUELSwRAQWwhBgwDBSAJIAFBAnRqIgEgASgCAEEBajYCACAGQQFqIQZBASAILQAAdEEBdSAFaiEFDAILAAsLQWwhBiAFRQ0AIAUQFEEBaiIBQQxLDQAgAyABNgIAQQFBASABdCAFayIDEBQiAXQgA0cNACAAIARqIAFBAWoiADoAACAJIABBAnRqIgAgACgCAEEBajYCACAJKAIEIgBBAkkgAEEBcXINACACIARBAWo2AgAgB0EBaiEGCyAKQZACaiQAIAYLxhEBDH8jAEHwAGsiBSQAQWwhCwJAIANBCkkNACACLwAAIQogAi8AAiEJIAIvAAQhByAFQQhqIAQQDgJAIAMgByAJIApqakEGaiIMSQ0AIAUtAAohCCAFQdgAaiACQQZqIgIgChAGIgsQAw0BIAVBQGsgAiAKaiICIAkQBiILEAMNASAFQShqIAIgCWoiAiAHEAYiCxADDQEgBUEQaiACIAdqIAMgDGsQBiILEAMNASAAIAFqIg9BfWohECAEQQRqIQZBASELIAAgAUEDakECdiIDaiIMIANqIgIgA2oiDiEDIAIhBCAMIQcDQCALIAMgEElxBEAgACAGIAVB2ABqIAgQAkECdGoiCS8BADsAACAFQdgAaiAJLQACEAEgCS0AAyELIAcgBiAFQUBrIAgQAkECdGoiCS8BADsAACAFQUBrIAktAAIQASAJLQADIQogBCAGIAVBKGogCBACQQJ0aiIJLwEAOwAAIAVBKGogCS0AAhABIAktAAMhCSADIAYgBUEQaiAIEAJBAnRqIg0vAQA7AAAgBUEQaiANLQACEAEgDS0AAyENIAAgC2oiCyAGIAVB2ABqIAgQAkECdGoiAC8BADsAACAFQdgAaiAALQACEAEgAC0AAyEAIAcgCmoiCiAGIAVBQGsgCBACQQJ0aiIHLwEAOwAAIAVBQGsgBy0AAhABIActAAMhByAEIAlqIgkgBiAFQShqIAgQAkECdGoiBC8BADsAACAFQShqIAQtAAIQASAELQADIQQgAyANaiIDIAYgBUEQaiAIEAJBAnRqIg0vAQA7AAAgBUEQaiANLQACEAEgACALaiEAIAcgCmohByAEIAlqIQQgAyANLQADaiEDIAVB2ABqEA0gBUFAaxANciAFQShqEA1yIAVBEGoQDXJFIQsMAQsLIAQgDksgByACS3INAEFsIQsgACAMSw0BIAxBfWohCQNAQQAgACAJSSAFQdgAahAEGwRAIAAgBiAFQdgAaiAIEAJBAnRqIgovAQA7AAAgBUHYAGogCi0AAhABIAAgCi0AA2oiACAGIAVB2ABqIAgQAkECdGoiCi8BADsAACAFQdgAaiAKLQACEAEgACAKLQADaiEADAEFIAxBfmohCgNAIAVB2ABqEAQgACAKS3JFBEAgACAGIAVB2ABqIAgQAkECdGoiCS8BADsAACAFQdgAaiAJLQACEAEgACAJLQADaiEADAELCwNAIAAgCk0EQCAAIAYgBUHYAGogCBACQQJ0aiIJLwEAOwAAIAVB2ABqIAktAAIQASAAIAktAANqIQAMAQsLAkAgACAMTw0AIAAgBiAFQdgAaiAIEAIiAEECdGoiDC0AADoAACAMLQADQQFGBEAgBUHYAGogDC0AAhABDAELIAUoAlxBH0sNACAFQdgAaiAGIABBAnRqLQACEAEgBSgCXEEhSQ0AIAVBIDYCXAsgAkF9aiEMA0BBACAHIAxJIAVBQGsQBBsEQCAHIAYgBUFAayAIEAJBAnRqIgAvAQA7AAAgBUFAayAALQACEAEgByAALQADaiIAIAYgBUFAayAIEAJBAnRqIgcvAQA7AAAgBUFAayAHLQACEAEgACAHLQADaiEHDAEFIAJBfmohDANAIAVBQGsQBCAHIAxLckUEQCAHIAYgBUFAayAIEAJBAnRqIgAvAQA7AAAgBUFAayAALQACEAEgByAALQADaiEHDAELCwNAIAcgDE0EQCAHIAYgBUFAayAIEAJBAnRqIgAvAQA7AAAgBUFAayAALQACEAEgByAALQADaiEHDAELCwJAIAcgAk8NACAHIAYgBUFAayAIEAIiAEECdGoiAi0AADoAACACLQADQQFGBEAgBUFAayACLQACEAEMAQsgBSgCREEfSw0AIAVBQGsgBiAAQQJ0ai0AAhABIAUoAkRBIUkNACAFQSA2AkQLIA5BfWohAgNAQQAgBCACSSAFQShqEAQbBEAgBCAGIAVBKGogCBACQQJ0aiIALwEAOwAAIAVBKGogAC0AAhABIAQgAC0AA2oiACAGIAVBKGogCBACQQJ0aiIELwEAOwAAIAVBKGogBC0AAhABIAAgBC0AA2ohBAwBBSAOQX5qIQIDQCAFQShqEAQgBCACS3JFBEAgBCAGIAVBKGogCBACQQJ0aiIALwEAOwAAIAVBKGogAC0AAhABIAQgAC0AA2ohBAwBCwsDQCAEIAJNBEAgBCAGIAVBKGogCBACQQJ0aiIALwEAOwAAIAVBKGogAC0AAhABIAQgAC0AA2ohBAwBCwsCQCAEIA5PDQAgBCAGIAVBKGogCBACIgBBAnRqIgItAAA6AAAgAi0AA0EBRgRAIAVBKGogAi0AAhABDAELIAUoAixBH0sNACAFQShqIAYgAEECdGotAAIQASAFKAIsQSFJDQAgBUEgNgIsCwNAQQAgAyAQSSAFQRBqEAQbBEAgAyAGIAVBEGogCBACQQJ0aiIALwEAOwAAIAVBEGogAC0AAhABIAMgAC0AA2oiACAGIAVBEGogCBACQQJ0aiICLwEAOwAAIAVBEGogAi0AAhABIAAgAi0AA2ohAwwBBSAPQX5qIQIDQCAFQRBqEAQgAyACS3JFBEAgAyAGIAVBEGogCBACQQJ0aiIALwEAOwAAIAVBEGogAC0AAhABIAMgAC0AA2ohAwwBCwsDQCADIAJNBEAgAyAGIAVBEGogCBACQQJ0aiIALwEAOwAAIAVBEGogAC0AAhABIAMgAC0AA2ohAwwBCwsCQCADIA9PDQAgAyAGIAVBEGogCBACIgBBAnRqIgItAAA6AAAgAi0AA0EBRgRAIAVBEGogAi0AAhABDAELIAUoAhRBH0sNACAFQRBqIAYgAEECdGotAAIQASAFKAIUQSFJDQAgBUEgNgIUCyABQWwgBUHYAGoQCiAFQUBrEApxIAVBKGoQCnEgBUEQahAKcRshCwwJCwAACwALAAALAAsAAAsACwAACwALQWwhCwsgBUHwAGokACALC7UEAQ5/IwBBEGsiBiQAIAZBBGogABAOQVQhBQJAIARB3AtJDQAgBi0ABCEHIANB8ARqQQBB7AAQECEIIAdBDEsNACADQdwJaiIJIAggBkEIaiAGQQxqIAEgAhAxIhAQA0UEQCAGKAIMIgQgB0sNASADQdwFaiEPIANBpAVqIREgAEEEaiESIANBqAVqIQEgBCEFA0AgBSICQX9qIQUgCCACQQJ0aigCAEUNAAsgAkEBaiEOQQEhBQNAIAUgDk9FBEAgCCAFQQJ0IgtqKAIAIQwgASALaiAKNgIAIAVBAWohBSAKIAxqIQoMAQsLIAEgCjYCAEEAIQUgBigCCCELA0AgBSALRkUEQCABIAUgCWotAAAiDEECdGoiDSANKAIAIg1BAWo2AgAgDyANQQF0aiINIAw6AAEgDSAFOgAAIAVBAWohBQwBCwtBACEBIANBADYCqAUgBEF/cyAHaiEJQQEhBQNAIAUgDk9FBEAgCCAFQQJ0IgtqKAIAIQwgAyALaiABNgIAIAwgBSAJanQgAWohASAFQQFqIQUMAQsLIAcgBEEBaiIBIAJrIgRrQQFqIQgDQEEBIQUgBCAIT0UEQANAIAUgDk9FBEAgBUECdCIJIAMgBEE0bGpqIAMgCWooAgAgBHY2AgAgBUEBaiEFDAELCyAEQQFqIQQMAQsLIBIgByAPIAogESADIAIgARBkIAZBAToABSAGIAc6AAYgACAGKAIENgIACyAQIQULIAZBEGokACAFC8ENAQt/IwBB8ABrIgUkAEFsIQkCQCADQQpJDQAgAi8AACEKIAIvAAIhDCACLwAEIQYgBUEIaiAEEA4CQCADIAYgCiAMampBBmoiDUkNACAFLQAKIQcgBUHYAGogAkEGaiICIAoQBiIJEAMNASAFQUBrIAIgCmoiAiAMEAYiCRADDQEgBUEoaiACIAxqIgIgBhAGIgkQAw0BIAVBEGogAiAGaiADIA1rEAYiCRADDQEgACABaiIOQX1qIQ8gBEEEaiEGQQEhCSAAIAFBA2pBAnYiAmoiCiACaiIMIAJqIg0hAyAMIQQgCiECA0AgCSADIA9JcQRAIAYgBUHYAGogBxACQQF0aiIILQAAIQsgBUHYAGogCC0AARABIAAgCzoAACAGIAVBQGsgBxACQQF0aiIILQAAIQsgBUFAayAILQABEAEgAiALOgAAIAYgBUEoaiAHEAJBAXRqIggtAAAhCyAFQShqIAgtAAEQASAEIAs6AAAgBiAFQRBqIAcQAkEBdGoiCC0AACELIAVBEGogCC0AARABIAMgCzoAACAGIAVB2ABqIAcQAkEBdGoiCC0AACELIAVB2ABqIAgtAAEQASAAIAs6AAEgBiAFQUBrIAcQAkEBdGoiCC0AACELIAVBQGsgCC0AARABIAIgCzoAASAGIAVBKGogBxACQQF0aiIILQAAIQsgBUEoaiAILQABEAEgBCALOgABIAYgBUEQaiAHEAJBAXRqIggtAAAhCyAFQRBqIAgtAAEQASADIAs6AAEgA0ECaiEDIARBAmohBCACQQJqIQIgAEECaiEAIAkgBUHYAGoQDUVxIAVBQGsQDUVxIAVBKGoQDUVxIAVBEGoQDUVxIQkMAQsLIAQgDUsgAiAMS3INAEFsIQkgACAKSw0BIApBfWohCQNAIAVB2ABqEAQgACAJT3JFBEAgBiAFQdgAaiAHEAJBAXRqIggtAAAhCyAFQdgAaiAILQABEAEgACALOgAAIAYgBUHYAGogBxACQQF0aiIILQAAIQsgBUHYAGogCC0AARABIAAgCzoAASAAQQJqIQAMAQsLA0AgBUHYAGoQBCAAIApPckUEQCAGIAVB2ABqIAcQAkEBdGoiCS0AACEIIAVB2ABqIAktAAEQASAAIAg6AAAgAEEBaiEADAELCwNAIAAgCkkEQCAGIAVB2ABqIAcQAkEBdGoiCS0AACEIIAVB2ABqIAktAAEQASAAIAg6AAAgAEEBaiEADAELCyAMQX1qIQADQCAFQUBrEAQgAiAAT3JFBEAgBiAFQUBrIAcQAkEBdGoiCi0AACEJIAVBQGsgCi0AARABIAIgCToAACAGIAVBQGsgBxACQQF0aiIKLQAAIQkgBUFAayAKLQABEAEgAiAJOgABIAJBAmohAgwBCwsDQCAFQUBrEAQgAiAMT3JFBEAgBiAFQUBrIAcQAkEBdGoiAC0AACEKIAVBQGsgAC0AARABIAIgCjoAACACQQFqIQIMAQsLA0AgAiAMSQRAIAYgBUFAayAHEAJBAXRqIgAtAAAhCiAFQUBrIAAtAAEQASACIAo6AAAgAkEBaiECDAELCyANQX1qIQADQCAFQShqEAQgBCAAT3JFBEAgBiAFQShqIAcQAkEBdGoiAi0AACEKIAVBKGogAi0AARABIAQgCjoAACAGIAVBKGogBxACQQF0aiICLQAAIQogBUEoaiACLQABEAEgBCAKOgABIARBAmohBAwBCwsDQCAFQShqEAQgBCANT3JFBEAgBiAFQShqIAcQAkEBdGoiAC0AACECIAVBKGogAC0AARABIAQgAjoAACAEQQFqIQQMAQsLA0AgBCANSQRAIAYgBUEoaiAHEAJBAXRqIgAtAAAhAiAFQShqIAAtAAEQASAEIAI6AAAgBEEBaiEEDAELCwNAIAVBEGoQBCADIA9PckUEQCAGIAVBEGogBxACQQF0aiIALQAAIQIgBUEQaiAALQABEAEgAyACOgAAIAYgBUEQaiAHEAJBAXRqIgAtAAAhAiAFQRBqIAAtAAEQASADIAI6AAEgA0ECaiEDDAELCwNAIAVBEGoQBCADIA5PckUEQCAGIAVBEGogBxACQQF0aiIALQAAIQIgBUEQaiAALQABEAEgAyACOgAAIANBAWohAwwBCwsDQCADIA5JBEAgBiAFQRBqIAcQAkEBdGoiAC0AACECIAVBEGogAC0AARABIAMgAjoAACADQQFqIQMMAQsLIAFBbCAFQdgAahAKIAVBQGsQCnEgBUEoahAKcSAFQRBqEApxGyEJDAELQWwhCQsgBUHwAGokACAJC8oCAQR/IwBBIGsiBSQAIAUgBBAOIAUtAAIhByAFQQhqIAIgAxAGIgIQA0UEQCAEQQRqIQIgACABaiIDQX1qIQQDQCAFQQhqEAQgACAET3JFBEAgAiAFQQhqIAcQAkEBdGoiBi0AACEIIAVBCGogBi0AARABIAAgCDoAACACIAVBCGogBxACQQF0aiIGLQAAIQggBUEIaiAGLQABEAEgACAIOgABIABBAmohAAwBCwsDQCAFQQhqEAQgACADT3JFBEAgAiAFQQhqIAcQAkEBdGoiBC0AACEGIAVBCGogBC0AARABIAAgBjoAACAAQQFqIQAMAQsLA0AgACADT0UEQCACIAVBCGogBxACQQF0aiIELQAAIQYgBUEIaiAELQABEAEgACAGOgAAIABBAWohAAwBCwsgAUFsIAVBCGoQChshAgsgBUEgaiQAIAILtgMBCX8jAEEQayIGJAAgBkEANgIMIAZBADYCCEFUIQQCQAJAIANBQGsiDCADIAZBCGogBkEMaiABIAIQMSICEAMNACAGQQRqIAAQDiAGKAIMIgcgBi0ABEEBaksNASAAQQRqIQogBkEAOgAFIAYgBzoABiAAIAYoAgQ2AgAgB0EBaiEJQQEhBANAIAQgCUkEQCADIARBAnRqIgEoAgAhACABIAU2AgAgACAEQX9qdCAFaiEFIARBAWohBAwBCwsgB0EBaiEHQQAhBSAGKAIIIQkDQCAFIAlGDQEgAyAFIAxqLQAAIgRBAnRqIgBBASAEdEEBdSILIAAoAgAiAWoiADYCACAHIARrIQhBACEEAkAgC0EDTQRAA0AgBCALRg0CIAogASAEakEBdGoiACAIOgABIAAgBToAACAEQQFqIQQMAAALAAsDQCABIABPDQEgCiABQQF0aiIEIAg6AAEgBCAFOgAAIAQgCDoAAyAEIAU6AAIgBCAIOgAFIAQgBToABCAEIAg6AAcgBCAFOgAGIAFBBGohAQwAAAsACyAFQQFqIQUMAAALAAsgAiEECyAGQRBqJAAgBAutAQECfwJAQYQgKAIAIABHIAAoAgBBAXYiAyABa0F4aiICQXhxQQhHcgR/IAIFIAMQJ0UNASACQQhqC0EQSQ0AIAAgACgCACICQQFxIAAgAWpBD2pBeHEiASAAa0EBdHI2AgAgASAANgIEIAEgASgCAEEBcSAAIAJBAXZqIAFrIgJBAXRyNgIAQYQgIAEgAkH/////B3FqQQRqQYQgKAIAIABGGyABNgIAIAEQJQsLygIBBX8CQAJAAkAgAEEIIABBCEsbZ0EfcyAAaUEBR2oiAUEESSAAIAF2cg0AIAFBAnRB/B5qKAIAIgJFDQADQCACQXhqIgMoAgBBAXZBeGoiBSAATwRAIAIgBUEIIAVBCEsbZ0Efc0ECdEGAH2oiASgCAEYEQCABIAIoAgQ2AgALDAMLIARBHksNASAEQQFqIQQgAigCBCICDQALC0EAIQMgAUEgTw0BA0AgAUECdEGAH2ooAgAiAkUEQCABQR5LIQIgAUEBaiEBIAJFDQEMAwsLIAIgAkF4aiIDKAIAQQF2QXhqIgFBCCABQQhLG2dBH3NBAnRBgB9qIgEoAgBGBEAgASACKAIENgIACwsgAigCACIBBEAgASACKAIENgIECyACKAIEIgEEQCABIAIoAgA2AgALIAMgAygCAEEBcjYCACADIAAQNwsgAwvhCwINfwV+IwBB8ABrIgckACAHIAAoAvDhASIINgJcIAEgAmohDSAIIAAoAoDiAWohDwJAAkAgBUUEQCABIQQMAQsgACgCxOABIRAgACgCwOABIREgACgCvOABIQ4gAEEBNgKM4QFBACEIA0AgCEEDRwRAIAcgCEECdCICaiAAIAJqQazQAWooAgA2AkQgCEEBaiEIDAELC0FsIQwgB0EYaiADIAQQBhADDQEgB0EsaiAHQRhqIAAoAgAQEyAHQTRqIAdBGGogACgCCBATIAdBPGogB0EYaiAAKAIEEBMgDUFgaiESIAEhBEEAIQwDQCAHKAIwIAcoAixBA3RqKQIAIhRCEIinQf8BcSEIIAcoAkAgBygCPEEDdGopAgAiFUIQiKdB/wFxIQsgBygCOCAHKAI0QQN0aikCACIWQiCIpyEJIBVCIIghFyAUQiCIpyECAkAgFkIQiKdB/wFxIgNBAk8EQAJAIAZFIANBGUlyRQRAIAkgB0EYaiADQSAgBygCHGsiCiAKIANLGyIKEAUgAyAKayIDdGohCSAHQRhqEAQaIANFDQEgB0EYaiADEAUgCWohCQwBCyAHQRhqIAMQBSAJaiEJIAdBGGoQBBoLIAcpAkQhGCAHIAk2AkQgByAYNwNIDAELAkAgA0UEQCACBEAgBygCRCEJDAMLIAcoAkghCQwBCwJAAkAgB0EYakEBEAUgCSACRWpqIgNBA0YEQCAHKAJEQX9qIgMgA0VqIQkMAQsgA0ECdCAHaigCRCIJIAlFaiEJIANBAUYNAQsgByAHKAJINgJMCwsgByAHKAJENgJIIAcgCTYCRAsgF6chAyALBEAgB0EYaiALEAUgA2ohAwsgCCALakEUTwRAIAdBGGoQBBoLIAgEQCAHQRhqIAgQBSACaiECCyAHQRhqEAQaIAcgB0EYaiAUQhiIp0H/AXEQCCAUp0H//wNxajYCLCAHIAdBGGogFUIYiKdB/wFxEAggFadB//8DcWo2AjwgB0EYahAEGiAHIAdBGGogFkIYiKdB/wFxEAggFqdB//8DcWo2AjQgByACNgJgIAcoAlwhCiAHIAk2AmggByADNgJkAkACQAJAIAQgAiADaiILaiASSw0AIAIgCmoiEyAPSw0AIA0gBGsgC0Egak8NAQsgByAHKQNoNwMQIAcgBykDYDcDCCAEIA0gB0EIaiAHQdwAaiAPIA4gESAQEB4hCwwBCyACIARqIQggBCAKEAcgAkERTwRAIARBEGohAgNAIAIgCkEQaiIKEAcgAkEQaiICIAhJDQALCyAIIAlrIQIgByATNgJcIAkgCCAOa0sEQCAJIAggEWtLBEBBbCELDAILIBAgAiAOayICaiIKIANqIBBNBEAgCCAKIAMQDxoMAgsgCCAKQQAgAmsQDyEIIAcgAiADaiIDNgJkIAggAmshCCAOIQILIAlBEE8EQCADIAhqIQMDQCAIIAIQByACQRBqIQIgCEEQaiIIIANJDQALDAELAkAgCUEHTQRAIAggAi0AADoAACAIIAItAAE6AAEgCCACLQACOgACIAggAi0AAzoAAyAIQQRqIAIgCUECdCIDQcAeaigCAGoiAhAXIAIgA0HgHmooAgBrIQIgBygCZCEDDAELIAggAhAMCyADQQlJDQAgAyAIaiEDIAhBCGoiCCACQQhqIgJrQQ9MBEADQCAIIAIQDCACQQhqIQIgCEEIaiIIIANJDQAMAgALAAsDQCAIIAIQByACQRBqIQIgCEEQaiIIIANJDQALCyAHQRhqEAQaIAsgDCALEAMiAhshDCAEIAQgC2ogAhshBCAFQX9qIgUNAAsgDBADDQFBbCEMIAdBGGoQBEECSQ0BQQAhCANAIAhBA0cEQCAAIAhBAnQiAmpBrNABaiACIAdqKAJENgIAIAhBAWohCAwBCwsgBygCXCEIC0G6fyEMIA8gCGsiACANIARrSw0AIAQEfyAEIAggABALIABqBUEACyABayEMCyAHQfAAaiQAIAwLkRcCFn8FfiMAQdABayIHJAAgByAAKALw4QEiCDYCvAEgASACaiESIAggACgCgOIBaiETAkACQCAFRQRAIAEhAwwBCyAAKALE4AEhESAAKALA4AEhFSAAKAK84AEhDyAAQQE2AozhAUEAIQgDQCAIQQNHBEAgByAIQQJ0IgJqIAAgAmpBrNABaigCADYCVCAIQQFqIQgMAQsLIAcgETYCZCAHIA82AmAgByABIA9rNgJoQWwhECAHQShqIAMgBBAGEAMNASAFQQQgBUEESBshFyAHQTxqIAdBKGogACgCABATIAdBxABqIAdBKGogACgCCBATIAdBzABqIAdBKGogACgCBBATQQAhBCAHQeAAaiEMIAdB5ABqIQoDQCAHQShqEARBAksgBCAXTnJFBEAgBygCQCAHKAI8QQN0aikCACIdQhCIp0H/AXEhCyAHKAJQIAcoAkxBA3RqKQIAIh5CEIinQf8BcSEJIAcoAkggBygCREEDdGopAgAiH0IgiKchCCAeQiCIISAgHUIgiKchAgJAIB9CEIinQf8BcSIDQQJPBEACQCAGRSADQRlJckUEQCAIIAdBKGogA0EgIAcoAixrIg0gDSADSxsiDRAFIAMgDWsiA3RqIQggB0EoahAEGiADRQ0BIAdBKGogAxAFIAhqIQgMAQsgB0EoaiADEAUgCGohCCAHQShqEAQaCyAHKQJUISEgByAINgJUIAcgITcDWAwBCwJAIANFBEAgAgRAIAcoAlQhCAwDCyAHKAJYIQgMAQsCQAJAIAdBKGpBARAFIAggAkVqaiIDQQNGBEAgBygCVEF/aiIDIANFaiEIDAELIANBAnQgB2ooAlQiCCAIRWohCCADQQFGDQELIAcgBygCWDYCXAsLIAcgBygCVDYCWCAHIAg2AlQLICCnIQMgCQRAIAdBKGogCRAFIANqIQMLIAkgC2pBFE8EQCAHQShqEAQaCyALBEAgB0EoaiALEAUgAmohAgsgB0EoahAEGiAHIAcoAmggAmoiCSADajYCaCAKIAwgCCAJSxsoAgAhDSAHIAdBKGogHUIYiKdB/wFxEAggHadB//8DcWo2AjwgByAHQShqIB5CGIinQf8BcRAIIB6nQf//A3FqNgJMIAdBKGoQBBogB0EoaiAfQhiIp0H/AXEQCCEOIAdB8ABqIARBBHRqIgsgCSANaiAIazYCDCALIAg2AgggCyADNgIEIAsgAjYCACAHIA4gH6dB//8DcWo2AkQgBEEBaiEEDAELCyAEIBdIDQEgEkFgaiEYIAdB4ABqIRogB0HkAGohGyABIQMDQCAHQShqEARBAksgBCAFTnJFBEAgBygCQCAHKAI8QQN0aikCACIdQhCIp0H/AXEhCyAHKAJQIAcoAkxBA3RqKQIAIh5CEIinQf8BcSEIIAcoAkggBygCREEDdGopAgAiH0IgiKchCSAeQiCIISAgHUIgiKchDAJAIB9CEIinQf8BcSICQQJPBEACQCAGRSACQRlJckUEQCAJIAdBKGogAkEgIAcoAixrIgogCiACSxsiChAFIAIgCmsiAnRqIQkgB0EoahAEGiACRQ0BIAdBKGogAhAFIAlqIQkMAQsgB0EoaiACEAUgCWohCSAHQShqEAQaCyAHKQJUISEgByAJNgJUIAcgITcDWAwBCwJAIAJFBEAgDARAIAcoAlQhCQwDCyAHKAJYIQkMAQsCQAJAIAdBKGpBARAFIAkgDEVqaiICQQNGBEAgBygCVEF/aiICIAJFaiEJDAELIAJBAnQgB2ooAlQiCSAJRWohCSACQQFGDQELIAcgBygCWDYCXAsLIAcgBygCVDYCWCAHIAk2AlQLICCnIRQgCARAIAdBKGogCBAFIBRqIRQLIAggC2pBFE8EQCAHQShqEAQaCyALBEAgB0EoaiALEAUgDGohDAsgB0EoahAEGiAHIAcoAmggDGoiGSAUajYCaCAbIBogCSAZSxsoAgAhHCAHIAdBKGogHUIYiKdB/wFxEAggHadB//8DcWo2AjwgByAHQShqIB5CGIinQf8BcRAIIB6nQf//A3FqNgJMIAdBKGoQBBogByAHQShqIB9CGIinQf8BcRAIIB+nQf//A3FqNgJEIAcgB0HwAGogBEEDcUEEdGoiDSkDCCIdNwPIASAHIA0pAwAiHjcDwAECQAJAAkAgBygCvAEiDiAepyICaiIWIBNLDQAgAyAHKALEASIKIAJqIgtqIBhLDQAgEiADayALQSBqTw0BCyAHIAcpA8gBNwMQIAcgBykDwAE3AwggAyASIAdBCGogB0G8AWogEyAPIBUgERAeIQsMAQsgAiADaiEIIAMgDhAHIAJBEU8EQCADQRBqIQIDQCACIA5BEGoiDhAHIAJBEGoiAiAISQ0ACwsgCCAdpyIOayECIAcgFjYCvAEgDiAIIA9rSwRAIA4gCCAVa0sEQEFsIQsMAgsgESACIA9rIgJqIhYgCmogEU0EQCAIIBYgChAPGgwCCyAIIBZBACACaxAPIQggByACIApqIgo2AsQBIAggAmshCCAPIQILIA5BEE8EQCAIIApqIQoDQCAIIAIQByACQRBqIQIgCEEQaiIIIApJDQALDAELAkAgDkEHTQRAIAggAi0AADoAACAIIAItAAE6AAEgCCACLQACOgACIAggAi0AAzoAAyAIQQRqIAIgDkECdCIKQcAeaigCAGoiAhAXIAIgCkHgHmooAgBrIQIgBygCxAEhCgwBCyAIIAIQDAsgCkEJSQ0AIAggCmohCiAIQQhqIgggAkEIaiICa0EPTARAA0AgCCACEAwgAkEIaiECIAhBCGoiCCAKSQ0ADAIACwALA0AgCCACEAcgAkEQaiECIAhBEGoiCCAKSQ0ACwsgCxADBEAgCyEQDAQFIA0gDDYCACANIBkgHGogCWs2AgwgDSAJNgIIIA0gFDYCBCAEQQFqIQQgAyALaiEDDAILAAsLIAQgBUgNASAEIBdrIQtBACEEA0AgCyAFSARAIAcgB0HwAGogC0EDcUEEdGoiAikDCCIdNwPIASAHIAIpAwAiHjcDwAECQAJAAkAgBygCvAEiDCAepyICaiIKIBNLDQAgAyAHKALEASIJIAJqIhBqIBhLDQAgEiADayAQQSBqTw0BCyAHIAcpA8gBNwMgIAcgBykDwAE3AxggAyASIAdBGGogB0G8AWogEyAPIBUgERAeIRAMAQsgAiADaiEIIAMgDBAHIAJBEU8EQCADQRBqIQIDQCACIAxBEGoiDBAHIAJBEGoiAiAISQ0ACwsgCCAdpyIGayECIAcgCjYCvAEgBiAIIA9rSwRAIAYgCCAVa0sEQEFsIRAMAgsgESACIA9rIgJqIgwgCWogEU0EQCAIIAwgCRAPGgwCCyAIIAxBACACaxAPIQggByACIAlqIgk2AsQBIAggAmshCCAPIQILIAZBEE8EQCAIIAlqIQYDQCAIIAIQByACQRBqIQIgCEEQaiIIIAZJDQALDAELAkAgBkEHTQRAIAggAi0AADoAACAIIAItAAE6AAEgCCACLQACOgACIAggAi0AAzoAAyAIQQRqIAIgBkECdCIGQcAeaigCAGoiAhAXIAIgBkHgHmooAgBrIQIgBygCxAEhCQwBCyAIIAIQDAsgCUEJSQ0AIAggCWohBiAIQQhqIgggAkEIaiICa0EPTARAA0AgCCACEAwgAkEIaiECIAhBCGoiCCAGSQ0ADAIACwALA0AgCCACEAcgAkEQaiECIAhBEGoiCCAGSQ0ACwsgEBADDQMgC0EBaiELIAMgEGohAwwBCwsDQCAEQQNHBEAgACAEQQJ0IgJqQazQAWogAiAHaigCVDYCACAEQQFqIQQMAQsLIAcoArwBIQgLQbp/IRAgEyAIayIAIBIgA2tLDQAgAwR/IAMgCCAAEAsgAGoFQQALIAFrIRALIAdB0AFqJAAgEAslACAAQgA3AgAgAEEAOwEIIABBADoACyAAIAE2AgwgACACOgAKC7QFAQN/IwBBMGsiBCQAIABB/wFqIgVBfWohBgJAIAMvAQIEQCAEQRhqIAEgAhAGIgIQAw0BIARBEGogBEEYaiADEBwgBEEIaiAEQRhqIAMQHCAAIQMDQAJAIARBGGoQBCADIAZPckUEQCADIARBEGogBEEYahASOgAAIAMgBEEIaiAEQRhqEBI6AAEgBEEYahAERQ0BIANBAmohAwsgBUF+aiEFAn8DQEG6fyECIAMiASAFSw0FIAEgBEEQaiAEQRhqEBI6AAAgAUEBaiEDIARBGGoQBEEDRgRAQQIhAiAEQQhqDAILIAMgBUsNBSABIARBCGogBEEYahASOgABIAFBAmohA0EDIQIgBEEYahAEQQNHDQALIARBEGoLIQUgAyAFIARBGGoQEjoAACABIAJqIABrIQIMAwsgAyAEQRBqIARBGGoQEjoAAiADIARBCGogBEEYahASOgADIANBBGohAwwAAAsACyAEQRhqIAEgAhAGIgIQAw0AIARBEGogBEEYaiADEBwgBEEIaiAEQRhqIAMQHCAAIQMDQAJAIARBGGoQBCADIAZPckUEQCADIARBEGogBEEYahAROgAAIAMgBEEIaiAEQRhqEBE6AAEgBEEYahAERQ0BIANBAmohAwsgBUF+aiEFAn8DQEG6fyECIAMiASAFSw0EIAEgBEEQaiAEQRhqEBE6AAAgAUEBaiEDIARBGGoQBEEDRgRAQQIhAiAEQQhqDAILIAMgBUsNBCABIARBCGogBEEYahAROgABIAFBAmohA0EDIQIgBEEYahAEQQNHDQALIARBEGoLIQUgAyAFIARBGGoQEToAACABIAJqIABrIQIMAgsgAyAEQRBqIARBGGoQEToAAiADIARBCGogBEEYahAROgADIANBBGohAwwAAAsACyAEQTBqJAAgAgtpAQF/An8CQAJAIAJBB00NACABKAAAQbfIwuF+Rw0AIAAgASgABDYCmOIBQWIgAEEQaiABIAIQPiIDEAMNAhogAEKBgICAEDcDiOEBIAAgASADaiACIANrECoMAQsgACABIAIQKgtBAAsLrQMBBn8jAEGAAWsiAyQAQWIhCAJAIAJBCUkNACAAQZjQAGogAUEIaiIEIAJBeGogAEGY0AAQMyIFEAMiBg0AIANBHzYCfCADIANB/ABqIANB+ABqIAQgBCAFaiAGGyIEIAEgAmoiAiAEaxAVIgUQAw0AIAMoAnwiBkEfSw0AIAMoAngiB0EJTw0AIABBiCBqIAMgBkGAC0GADCAHEBggA0E0NgJ8IAMgA0H8AGogA0H4AGogBCAFaiIEIAIgBGsQFSIFEAMNACADKAJ8IgZBNEsNACADKAJ4IgdBCk8NACAAQZAwaiADIAZBgA1B4A4gBxAYIANBIzYCfCADIANB/ABqIANB+ABqIAQgBWoiBCACIARrEBUiBRADDQAgAygCfCIGQSNLDQAgAygCeCIHQQpPDQAgACADIAZBwBBB0BEgBxAYIAQgBWoiBEEMaiIFIAJLDQAgAiAFayEFQQAhAgNAIAJBA0cEQCAEKAAAIgZBf2ogBU8NAiAAIAJBAnRqQZzQAWogBjYCACACQQFqIQIgBEEEaiEEDAELCyAEIAFrIQgLIANBgAFqJAAgCAtGAQN/IABBCGohAyAAKAIEIQJBACEAA0AgACACdkUEQCABIAMgAEEDdGotAAJBFktqIQEgAEEBaiEADAELCyABQQggAmt0C4YDAQV/Qbh/IQcCQCADRQ0AIAItAAAiBEUEQCABQQA2AgBBAUG4fyADQQFGGw8LAn8gAkEBaiIFIARBGHRBGHUiBkF/Sg0AGiAGQX9GBEAgA0EDSA0CIAUvAABBgP4BaiEEIAJBA2oMAQsgA0ECSA0BIAItAAEgBEEIdHJBgIB+aiEEIAJBAmoLIQUgASAENgIAIAVBAWoiASACIANqIgNLDQBBbCEHIABBEGogACAFLQAAIgVBBnZBI0EJIAEgAyABa0HAEEHQEUHwEiAAKAKM4QEgACgCnOIBIAQQHyIGEAMiCA0AIABBmCBqIABBCGogBUEEdkEDcUEfQQggASABIAZqIAgbIgEgAyABa0GAC0GADEGAFyAAKAKM4QEgACgCnOIBIAQQHyIGEAMiCA0AIABBoDBqIABBBGogBUECdkEDcUE0QQkgASABIAZqIAgbIgEgAyABa0GADUHgDkGQGSAAKAKM4QEgACgCnOIBIAQQHyIAEAMNACAAIAFqIAJrIQcLIAcLrQMBCn8jAEGABGsiCCQAAn9BUiACQf8BSw0AGkFUIANBDEsNABogAkEBaiELIABBBGohCUGAgAQgA0F/anRBEHUhCkEAIQJBASEEQQEgA3QiB0F/aiIMIQUDQCACIAtGRQRAAkAgASACQQF0Ig1qLwEAIgZB//8DRgRAIAkgBUECdGogAjoAAiAFQX9qIQVBASEGDAELIARBACAKIAZBEHRBEHVKGyEECyAIIA1qIAY7AQAgAkEBaiECDAELCyAAIAQ7AQIgACADOwEAIAdBA3YgB0EBdmpBA2ohBkEAIQRBACECA0AgBCALRkUEQCABIARBAXRqLgEAIQpBACEAA0AgACAKTkUEQCAJIAJBAnRqIAQ6AAIDQCACIAZqIAxxIgIgBUsNAAsgAEEBaiEADAELCyAEQQFqIQQMAQsLQX8gAg0AGkEAIQIDfyACIAdGBH9BAAUgCCAJIAJBAnRqIgAtAAJBAXRqIgEgAS8BACIBQQFqOwEAIAAgAyABEBRrIgU6AAMgACABIAVB/wFxdCAHazsBACACQQFqIQIMAQsLCyEFIAhBgARqJAAgBQvjBgEIf0FsIQcCQCACQQNJDQACQAJAAkACQCABLQAAIgNBA3EiCUEBaw4DAwEAAgsgACgCiOEBDQBBYg8LIAJBBUkNAkEDIQYgASgAACEFAn8CQAJAIANBAnZBA3EiCEF+aiIEQQFNBEAgBEEBaw0BDAILIAVBDnZB/wdxIQQgBUEEdkH/B3EhAyAIRQwCCyAFQRJ2IQRBBCEGIAVBBHZB//8AcSEDQQAMAQsgBUEEdkH//w9xIgNBgIAISw0DIAEtAARBCnQgBUEWdnIhBEEFIQZBAAshBSAEIAZqIgogAksNAgJAIANBgQZJDQAgACgCnOIBRQ0AQQAhAgNAIAJBg4ABSw0BIAJBQGshAgwAAAsACwJ/IAlBA0YEQCABIAZqIQEgAEHw4gFqIQIgACgCDCEGIAUEQCACIAMgASAEIAYQXwwCCyACIAMgASAEIAYQXQwBCyAAQbjQAWohAiABIAZqIQEgAEHw4gFqIQYgAEGo0ABqIQggBQRAIAggBiADIAEgBCACEF4MAQsgCCAGIAMgASAEIAIQXAsQAw0CIAAgAzYCgOIBIABBATYCiOEBIAAgAEHw4gFqNgLw4QEgCUECRgRAIAAgAEGo0ABqNgIMCyAAIANqIgBBiOMBakIANwAAIABBgOMBakIANwAAIABB+OIBakIANwAAIABB8OIBakIANwAAIAoPCwJ/AkACQAJAIANBAnZBA3FBf2oiBEECSw0AIARBAWsOAgACAQtBASEEIANBA3YMAgtBAiEEIAEvAABBBHYMAQtBAyEEIAEQIUEEdgsiAyAEaiIFQSBqIAJLBEAgBSACSw0CIABB8OIBaiABIARqIAMQCyEBIAAgAzYCgOIBIAAgATYC8OEBIAEgA2oiAEIANwAYIABCADcAECAAQgA3AAggAEIANwAAIAUPCyAAIAM2AoDiASAAIAEgBGo2AvDhASAFDwsCfwJAAkACQCADQQJ2QQNxQX9qIgRBAksNACAEQQFrDgIAAgELQQEhByADQQN2DAILQQIhByABLwAAQQR2DAELIAJBBEkgARAhIgJBj4CAAUtyDQFBAyEHIAJBBHYLIQIgAEHw4gFqIAEgB2otAAAgAkEgahAQIQEgACACNgKA4gEgACABNgLw4QEgB0EBaiEHCyAHC0sAIABC+erQ0OfJoeThADcDICAAQgA3AxggAELP1tO+0ser2UI3AxAgAELW64Lu6v2J9eAANwMIIABCADcDACAAQShqQQBBKBAQGgviAgICfwV+IABBKGoiASAAKAJIaiECAn4gACkDACIDQiBaBEAgACkDECIEQgeJIAApAwgiBUIBiXwgACkDGCIGQgyJfCAAKQMgIgdCEol8IAUQGSAEEBkgBhAZIAcQGQwBCyAAKQMYQsXP2bLx5brqJ3wLIAN8IQMDQCABQQhqIgAgAk0EQEIAIAEpAAAQCSADhUIbiUKHla+vmLbem55/fkLj3MqV/M7y9YV/fCEDIAAhAQwBCwsCQCABQQRqIgAgAksEQCABIQAMAQsgASgAAK1Ch5Wvr5i23puef34gA4VCF4lCz9bTvtLHq9lCfkL5893xmfaZqxZ8IQMLA0AgACACSQRAIAAxAABCxc/ZsvHluuonfiADhUILiUKHla+vmLbem55/fiEDIABBAWohAAwBCwsgA0IhiCADhULP1tO+0ser2UJ+IgNCHYggA4VC+fPd8Zn2masWfiIDQiCIIAOFC+8CAgJ/BH4gACAAKQMAIAKtfDcDAAJAAkAgACgCSCIDIAJqIgRBH00EQCABRQ0BIAAgA2pBKGogASACECAgACgCSCACaiEEDAELIAEgAmohAgJ/IAMEQCAAQShqIgQgA2ogAUEgIANrECAgACAAKQMIIAQpAAAQCTcDCCAAIAApAxAgACkAMBAJNwMQIAAgACkDGCAAKQA4EAk3AxggACAAKQMgIABBQGspAAAQCTcDICAAKAJIIQMgAEEANgJIIAEgA2tBIGohAQsgAUEgaiACTQsEQCACQWBqIQMgACkDICEFIAApAxghBiAAKQMQIQcgACkDCCEIA0AgCCABKQAAEAkhCCAHIAEpAAgQCSEHIAYgASkAEBAJIQYgBSABKQAYEAkhBSABQSBqIgEgA00NAAsgACAFNwMgIAAgBjcDGCAAIAc3AxAgACAINwMICyABIAJPDQEgAEEoaiABIAIgAWsiBBAgCyAAIAQ2AkgLCy8BAX8gAEUEQEG2f0EAIAMbDwtBun8hBCADIAFNBH8gACACIAMQEBogAwVBun8LCy8BAX8gAEUEQEG2f0EAIAMbDwtBun8hBCADIAFNBH8gACACIAMQCxogAwVBun8LC6gCAQZ/IwBBEGsiByQAIABB2OABaikDAEKAgIAQViEIQbh/IQUCQCAEQf//B0sNACAAIAMgBBBCIgUQAyIGDQAgACgCnOIBIQkgACAHQQxqIAMgAyAFaiAGGyIKIARBACAFIAYbayIGEEAiAxADBEAgAyEFDAELIAcoAgwhBCABRQRAQbp/IQUgBEEASg0BCyAGIANrIQUgAyAKaiEDAkAgCQRAIABBADYCnOIBDAELAkACQAJAIARBBUgNACAAQdjgAWopAwBCgICACFgNAAwBCyAAQQA2ApziAQwBCyAAKAIIED8hBiAAQQA2ApziASAGQRRPDQELIAAgASACIAMgBSAEIAgQOSEFDAELIAAgASACIAMgBSAEIAgQOiEFCyAHQRBqJAAgBQtnACAAQdDgAWogASACIAAoAuzhARAuIgEQAwRAIAEPC0G4fyECAkAgAQ0AIABB7OABaigCACIBBEBBYCECIAAoApjiASABRw0BC0EAIQIgAEHw4AFqKAIARQ0AIABBkOEBahBDCyACCycBAX8QVyIERQRAQUAPCyAEIAAgASACIAMgBBBLEE8hACAEEFYgAAs/AQF/AkACQAJAIAAoAqDiAUEBaiIBQQJLDQAgAUEBaw4CAAECCyAAEDBBAA8LIABBADYCoOIBCyAAKAKU4gELvAMCB38BfiMAQRBrIgkkAEG4fyEGAkAgBCgCACIIQQVBCSAAKALs4QEiBRtJDQAgAygCACIHQQFBBSAFGyAFEC8iBRADBEAgBSEGDAELIAggBUEDakkNACAAIAcgBRBJIgYQAw0AIAEgAmohCiAAQZDhAWohCyAIIAVrIQIgBSAHaiEHIAEhBQNAIAcgAiAJECwiBhADDQEgAkF9aiICIAZJBEBBuH8hBgwCCyAJKAIAIghBAksEQEFsIQYMAgsgB0EDaiEHAn8CQAJAAkAgCEEBaw4CAgABCyAAIAUgCiAFayAHIAYQSAwCCyAFIAogBWsgByAGEEcMAQsgBSAKIAVrIActAAAgCSgCCBBGCyIIEAMEQCAIIQYMAgsgACgC8OABBEAgCyAFIAgQRQsgAiAGayECIAYgB2ohByAFIAhqIQUgCSgCBEUNAAsgACkD0OABIgxCf1IEQEFsIQYgDCAFIAFrrFINAQsgACgC8OABBEBBaiEGIAJBBEkNASALEEQhDCAHKAAAIAynRw0BIAdBBGohByACQXxqIQILIAMgBzYCACAEIAI2AgAgBSABayEGCyAJQRBqJAAgBgsuACAAECsCf0EAQQAQAw0AGiABRSACRXJFBEBBYiAAIAEgAhA9EAMNARoLQQALCzcAIAEEQCAAIAAoAsTgASABKAIEIAEoAghqRzYCnOIBCyAAECtBABADIAFFckUEQCAAIAEQWwsL0QIBB38jAEEQayIGJAAgBiAENgIIIAYgAzYCDCAFBEAgBSgCBCEKIAUoAgghCQsgASEIAkACQANAIAAoAuzhARAWIQsCQANAIAQgC0kNASADKAAAQXBxQdDUtMIBRgRAIAMgBBAiIgcQAw0EIAQgB2shBCADIAdqIQMMAQsLIAYgAzYCDCAGIAQ2AggCQCAFBEAgACAFEE5BACEHQQAQA0UNAQwFCyAAIAogCRBNIgcQAw0ECyAAIAgQUCAMQQFHQQAgACAIIAIgBkEMaiAGQQhqEEwiByIDa0EAIAMQAxtBCkdyRQRAQbh/IQcMBAsgBxADDQMgAiAHayECIAcgCGohCEEBIQwgBigCDCEDIAYoAgghBAwBCwsgBiADNgIMIAYgBDYCCEG4fyEHIAQNASAIIAFrIQcMAQsgBiADNgIMIAYgBDYCCAsgBkEQaiQAIAcLRgECfyABIAAoArjgASICRwRAIAAgAjYCxOABIAAgATYCuOABIAAoArzgASEDIAAgATYCvOABIAAgASADIAJrajYCwOABCwutAgIEfwF+IwBBQGoiBCQAAkACQCACQQhJDQAgASgAAEFwcUHQ1LTCAUcNACABIAIQIiEBIABCADcDCCAAQQA2AgQgACABNgIADAELIARBGGogASACEC0iAxADBEAgACADEBoMAQsgAwRAIABBuH8QGgwBCyACIAQoAjAiA2shAiABIANqIQMDQAJAIAAgAyACIARBCGoQLCIFEAMEfyAFBSACIAVBA2oiBU8NAUG4fwsQGgwCCyAGQQFqIQYgAiAFayECIAMgBWohAyAEKAIMRQ0ACyAEKAI4BEAgAkEDTQRAIABBuH8QGgwCCyADQQRqIQMLIAQoAighAiAEKQMYIQcgAEEANgIEIAAgAyABazYCACAAIAIgBmytIAcgB0J/URs3AwgLIARBQGskAAslAQF/IwBBEGsiAiQAIAIgACABEFEgAigCACEAIAJBEGokACAAC30BBH8jAEGQBGsiBCQAIARB/wE2AggCQCAEQRBqIARBCGogBEEMaiABIAIQFSIGEAMEQCAGIQUMAQtBVCEFIAQoAgwiB0EGSw0AIAMgBEEQaiAEKAIIIAcQQSIFEAMNACAAIAEgBmogAiAGayADEDwhBQsgBEGQBGokACAFC4cBAgJ/An5BABAWIQMCQANAIAEgA08EQAJAIAAoAABBcHFB0NS0wgFGBEAgACABECIiAhADRQ0BQn4PCyAAIAEQVSIEQn1WDQMgBCAFfCIFIARUIQJCfiEEIAINAyAAIAEQUiICEAMNAwsgASACayEBIAAgAmohAAwBCwtCfiAFIAEbIQQLIAQLPwIBfwF+IwBBMGsiAiQAAn5CfiACQQhqIAAgARAtDQAaQgAgAigCHEEBRg0AGiACKQMICyEDIAJBMGokACADC40BAQJ/IwBBMGsiASQAAkAgAEUNACAAKAKI4gENACABIABB/OEBaigCADYCKCABIAApAvThATcDICAAEDAgACgCqOIBIQIgASABKAIoNgIYIAEgASkDIDcDECACIAFBEGoQGyAAQQA2AqjiASABIAEoAig2AgggASABKQMgNwMAIAAgARAbCyABQTBqJAALKgECfyMAQRBrIgAkACAAQQA2AgggAEIANwMAIAAQWCEBIABBEGokACABC4cBAQN/IwBBEGsiAiQAAkAgACgCAEUgACgCBEVzDQAgAiAAKAIINgIIIAIgACkCADcDAAJ/IAIoAgAiAQRAIAIoAghBqOMJIAERBQAMAQtBqOMJECgLIgFFDQAgASAAKQIANwL04QEgAUH84QFqIAAoAgg2AgAgARBZIAEhAwsgAkEQaiQAIAMLywEBAn8jAEEgayIBJAAgAEGBgIDAADYCtOIBIABBADYCiOIBIABBADYC7OEBIABCADcDkOIBIABBADYCpOMJIABBADYC3OIBIABCADcCzOIBIABBADYCvOIBIABBADYCxOABIABCADcCnOIBIABBpOIBakIANwIAIABBrOIBakEANgIAIAFCADcCECABQgA3AhggASABKQMYNwMIIAEgASkDEDcDACABKAIIQQh2QQFxIQIgAEEANgLg4gEgACACNgKM4gEgAUEgaiQAC3YBA38jAEEwayIBJAAgAARAIAEgAEHE0AFqIgIoAgA2AiggASAAKQK80AE3AyAgACgCACEDIAEgAigCADYCGCABIAApArzQATcDECADIAFBEGoQGyABIAEoAig2AgggASABKQMgNwMAIAAgARAbCyABQTBqJAALzAEBAX8gACABKAK00AE2ApjiASAAIAEoAgQiAjYCwOABIAAgAjYCvOABIAAgAiABKAIIaiICNgK44AEgACACNgLE4AEgASgCuNABBEAgAEKBgICAEDcDiOEBIAAgAUGk0ABqNgIMIAAgAUGUIGo2AgggACABQZwwajYCBCAAIAFBDGo2AgAgAEGs0AFqIAFBqNABaigCADYCACAAQbDQAWogAUGs0AFqKAIANgIAIABBtNABaiABQbDQAWooAgA2AgAPCyAAQgA3A4jhAQs7ACACRQRAQbp/DwsgBEUEQEFsDwsgAiAEEGAEQCAAIAEgAiADIAQgBRBhDwsgACABIAIgAyAEIAUQZQtGAQF/IwBBEGsiBSQAIAVBCGogBBAOAn8gBS0ACQRAIAAgASACIAMgBBAyDAELIAAgASACIAMgBBA0CyEAIAVBEGokACAACzQAIAAgAyAEIAUQNiIFEAMEQCAFDwsgBSAESQR/IAEgAiADIAVqIAQgBWsgABA1BUG4fwsLRgEBfyMAQRBrIgUkACAFQQhqIAQQDgJ/IAUtAAkEQCAAIAEgAiADIAQQYgwBCyAAIAEgAiADIAQQNQshACAFQRBqJAAgAAtZAQF/QQ8hAiABIABJBEAgAUEEdCAAbiECCyAAQQh2IgEgAkEYbCIAQYwIaigCAGwgAEGICGooAgBqIgJBA3YgAmogAEGACGooAgAgAEGECGooAgAgAWxqSQs3ACAAIAMgBCAFQYAQEDMiBRADBEAgBQ8LIAUgBEkEfyABIAIgAyAFaiAEIAVrIAAQMgVBuH8LC78DAQN/IwBBIGsiBSQAIAVBCGogAiADEAYiAhADRQRAIAAgAWoiB0F9aiEGIAUgBBAOIARBBGohAiAFLQACIQMDQEEAIAAgBkkgBUEIahAEGwRAIAAgAiAFQQhqIAMQAkECdGoiBC8BADsAACAFQQhqIAQtAAIQASAAIAQtAANqIgQgAiAFQQhqIAMQAkECdGoiAC8BADsAACAFQQhqIAAtAAIQASAEIAAtAANqIQAMAQUgB0F+aiEEA0AgBUEIahAEIAAgBEtyRQRAIAAgAiAFQQhqIAMQAkECdGoiBi8BADsAACAFQQhqIAYtAAIQASAAIAYtAANqIQAMAQsLA0AgACAES0UEQCAAIAIgBUEIaiADEAJBAnRqIgYvAQA7AAAgBUEIaiAGLQACEAEgACAGLQADaiEADAELCwJAIAAgB08NACAAIAIgBUEIaiADEAIiA0ECdGoiAC0AADoAACAALQADQQFGBEAgBUEIaiAALQACEAEMAQsgBSgCDEEfSw0AIAVBCGogAiADQQJ0ai0AAhABIAUoAgxBIUkNACAFQSA2AgwLIAFBbCAFQQhqEAobIQILCwsgBUEgaiQAIAILkgIBBH8jAEFAaiIJJAAgCSADQTQQCyEDAkAgBEECSA0AIAMgBEECdGooAgAhCSADQTxqIAgQIyADQQE6AD8gAyACOgA+QQAhBCADKAI8IQoDQCAEIAlGDQEgACAEQQJ0aiAKNgEAIARBAWohBAwAAAsAC0EAIQkDQCAGIAlGRQRAIAMgBSAJQQF0aiIKLQABIgtBAnRqIgwoAgAhBCADQTxqIAotAABBCHQgCGpB//8DcRAjIANBAjoAPyADIAcgC2siCiACajoAPiAEQQEgASAKa3RqIQogAygCPCELA0AgACAEQQJ0aiALNgEAIARBAWoiBCAKSQ0ACyAMIAo2AgAgCUEBaiEJDAELCyADQUBrJAALowIBCX8jAEHQAGsiCSQAIAlBEGogBUE0EAsaIAcgBmshDyAHIAFrIRADQAJAIAMgCkcEQEEBIAEgByACIApBAXRqIgYtAAEiDGsiCGsiC3QhDSAGLQAAIQ4gCUEQaiAMQQJ0aiIMKAIAIQYgCyAPTwRAIAAgBkECdGogCyAIIAUgCEE0bGogCCAQaiIIQQEgCEEBShsiCCACIAQgCEECdGooAgAiCEEBdGogAyAIayAHIA4QYyAGIA1qIQgMAgsgCUEMaiAOECMgCUEBOgAPIAkgCDoADiAGIA1qIQggCSgCDCELA0AgBiAITw0CIAAgBkECdGogCzYBACAGQQFqIQYMAAALAAsgCUHQAGokAA8LIAwgCDYCACAKQQFqIQoMAAALAAs0ACAAIAMgBCAFEDYiBRADBEAgBQ8LIAUgBEkEfyABIAIgAyAFaiAEIAVrIAAQNAVBuH8LCyMAIAA/AEEQdGtB//8DakEQdkAAQX9GBEBBAA8LQQAQAEEBCzsBAX8gAgRAA0AgACABIAJBgCAgAkGAIEkbIgMQCyEAIAFBgCBqIQEgAEGAIGohACACIANrIgINAAsLCwYAIAAQAwsLqBUJAEGICAsNAQAAAAEAAAACAAAAAgBBoAgLswYBAAAAAQAAAAIAAAACAAAAJgAAAIIAAAAhBQAASgAAAGcIAAAmAAAAwAEAAIAAAABJBQAASgAAAL4IAAApAAAALAIAAIAAAABJBQAASgAAAL4IAAAvAAAAygIAAIAAAACKBQAASgAAAIQJAAA1AAAAcwMAAIAAAACdBQAASgAAAKAJAAA9AAAAgQMAAIAAAADrBQAASwAAAD4KAABEAAAAngMAAIAAAABNBgAASwAAAKoKAABLAAAAswMAAIAAAADBBgAATQAAAB8NAABNAAAAUwQAAIAAAAAjCAAAUQAAAKYPAABUAAAAmQQAAIAAAABLCQAAVwAAALESAABYAAAA2gQAAIAAAABvCQAAXQAAACMUAABUAAAARQUAAIAAAABUCgAAagAAAIwUAABqAAAArwUAAIAAAAB2CQAAfAAAAE4QAAB8AAAA0gIAAIAAAABjBwAAkQAAAJAHAACSAAAAAAAAAAEAAAABAAAABQAAAA0AAAAdAAAAPQAAAH0AAAD9AAAA/QEAAP0DAAD9BwAA/Q8AAP0fAAD9PwAA/X8AAP3/AAD9/wEA/f8DAP3/BwD9/w8A/f8fAP3/PwD9/38A/f//AP3//wH9//8D/f//B/3//w/9//8f/f//P/3//38AAAAAAQAAAAIAAAADAAAABAAAAAUAAAAGAAAABwAAAAgAAAAJAAAACgAAAAsAAAAMAAAADQAAAA4AAAAPAAAAEAAAABEAAAASAAAAEwAAABQAAAAVAAAAFgAAABcAAAAYAAAAGQAAABoAAAAbAAAAHAAAAB0AAAAeAAAAHwAAAAMAAAAEAAAABQAAAAYAAAAHAAAACAAAAAkAAAAKAAAACwAAAAwAAAANAAAADgAAAA8AAAAQAAAAEQAAABIAAAATAAAAFAAAABUAAAAWAAAAFwAAABgAAAAZAAAAGgAAABsAAAAcAAAAHQAAAB4AAAAfAAAAIAAAACEAAAAiAAAAIwAAACUAAAAnAAAAKQAAACsAAAAvAAAAMwAAADsAAABDAAAAUwAAAGMAAACDAAAAAwEAAAMCAAADBAAAAwgAAAMQAAADIAAAA0AAAAOAAAADAAEAQeAPC1EBAAAAAQAAAAEAAAABAAAAAgAAAAIAAAADAAAAAwAAAAQAAAAEAAAABQAAAAcAAAAIAAAACQAAAAoAAAALAAAADAAAAA0AAAAOAAAADwAAABAAQcQQC4sBAQAAAAIAAAADAAAABAAAAAUAAAAGAAAABwAAAAgAAAAJAAAACgAAAAsAAAAMAAAADQAAAA4AAAAPAAAAEAAAABIAAAAUAAAAFgAAABgAAAAcAAAAIAAAACgAAAAwAAAAQAAAAIAAAAAAAQAAAAIAAAAEAAAACAAAABAAAAAgAAAAQAAAAIAAAAAAAQBBkBIL5gQBAAAAAQAAAAEAAAABAAAAAgAAAAIAAAADAAAAAwAAAAQAAAAGAAAABwAAAAgAAAAJAAAACgAAAAsAAAAMAAAADQAAAA4AAAAPAAAAEAAAAAEAAAAEAAAACAAAAAAAAAABAAEBBgAAAAAAAAQAAAAAEAAABAAAAAAgAAAFAQAAAAAAAAUDAAAAAAAABQQAAAAAAAAFBgAAAAAAAAUHAAAAAAAABQkAAAAAAAAFCgAAAAAAAAUMAAAAAAAABg4AAAAAAAEFEAAAAAAAAQUUAAAAAAABBRYAAAAAAAIFHAAAAAAAAwUgAAAAAAAEBTAAAAAgAAYFQAAAAAAABwWAAAAAAAAIBgABAAAAAAoGAAQAAAAADAYAEAAAIAAABAAAAAAAAAAEAQAAAAAAAAUCAAAAIAAABQQAAAAAAAAFBQAAACAAAAUHAAAAAAAABQgAAAAgAAAFCgAAAAAAAAULAAAAAAAABg0AAAAgAAEFEAAAAAAAAQUSAAAAIAABBRYAAAAAAAIFGAAAACAAAwUgAAAAAAADBSgAAAAAAAYEQAAAABAABgRAAAAAIAAHBYAAAAAAAAkGAAIAAAAACwYACAAAMAAABAAAAAAQAAAEAQAAACAAAAUCAAAAIAAABQMAAAAgAAAFBQAAACAAAAUGAAAAIAAABQgAAAAgAAAFCQAAACAAAAULAAAAIAAABQwAAAAAAAAGDwAAACAAAQUSAAAAIAABBRQAAAAgAAIFGAAAACAAAgUcAAAAIAADBSgAAAAgAAQFMAAAAAAAEAYAAAEAAAAPBgCAAAAAAA4GAEAAAAAADQYAIABBgBcLhwIBAAEBBQAAAAAAAAUAAAAAAAAGBD0AAAAAAAkF/QEAAAAADwX9fwAAAAAVBf3/HwAAAAMFBQAAAAAABwR9AAAAAAAMBf0PAAAAABIF/f8DAAAAFwX9/38AAAAFBR0AAAAAAAgE/QAAAAAADgX9PwAAAAAUBf3/DwAAAAIFAQAAABAABwR9AAAAAAALBf0HAAAAABEF/f8BAAAAFgX9/z8AAAAEBQ0AAAAQAAgE/QAAAAAADQX9HwAAAAATBf3/BwAAAAEFAQAAABAABgQ9AAAAAAAKBf0DAAAAABAF/f8AAAAAHAX9//8PAAAbBf3//wcAABoF/f//AwAAGQX9//8BAAAYBf3//wBBkBkLhgQBAAEBBgAAAAAAAAYDAAAAAAAABAQAAAAgAAAFBQAAAAAAAAUGAAAAAAAABQgAAAAAAAAFCQAAAAAAAAULAAAAAAAABg0AAAAAAAAGEAAAAAAAAAYTAAAAAAAABhYAAAAAAAAGGQAAAAAAAAYcAAAAAAAABh8AAAAAAAAGIgAAAAAAAQYlAAAAAAABBikAAAAAAAIGLwAAAAAAAwY7AAAAAAAEBlMAAAAAAAcGgwAAAAAACQYDAgAAEAAABAQAAAAAAAAEBQAAACAAAAUGAAAAAAAABQcAAAAgAAAFCQAAAAAAAAUKAAAAAAAABgwAAAAAAAAGDwAAAAAAAAYSAAAAAAAABhUAAAAAAAAGGAAAAAAAAAYbAAAAAAAABh4AAAAAAAAGIQAAAAAAAQYjAAAAAAABBicAAAAAAAIGKwAAAAAAAwYzAAAAAAAEBkMAAAAAAAUGYwAAAAAACAYDAQAAIAAABAQAAAAwAAAEBAAAABAAAAQFAAAAIAAABQcAAAAgAAAFCAAAACAAAAUKAAAAIAAABQsAAAAAAAAGDgAAAAAAAAYRAAAAAAAABhQAAAAAAAAGFwAAAAAAAAYaAAAAAAAABh0AAAAAAAAGIAAAAAAAEAYDAAEAAAAPBgOAAAAAAA4GA0AAAAAADQYDIAAAAAAMBgMQAAAAAAsGAwgAAAAACgYDBABBpB0L2QEBAAAAAwAAAAcAAAAPAAAAHwAAAD8AAAB/AAAA/wAAAP8BAAD/AwAA/wcAAP8PAAD/HwAA/z8AAP9/AAD//wAA//8BAP//AwD//wcA//8PAP//HwD//z8A//9/AP///wD///8B////A////wf///8P////H////z////9/AAAAAAEAAAACAAAABAAAAAAAAAACAAAABAAAAAgAAAAAAAAAAQAAAAIAAAABAAAABAAAAAQAAAAEAAAABAAAAAgAAAAIAAAACAAAAAcAAAAIAAAACQAAAAoAAAALAEGgIAsDwBBQ",Nw="display-p3",Ow="display-p3-linear";({...lt.spaces[Bt]});const iu=new WeakMap;let su=0,ru;class Pn extends Rs{constructor(e){super(e),this.transcoderPath="",this.transcoderBinary=null,this.transcoderPending=null,this.workerPool=new Iw,this.workerSourceURL="",this.workerConfig=null,typeof MSC_TRANSCODER<"u"&&console.warn('THREE.KTX2Loader: Please update to latest "basis_transcoder". "msc_basis_transcoder" is no longer supported in three.js r125+.')}setTranscoderPath(e){return this.transcoderPath=e,this}setWorkerLimit(e){return this.workerPool.setWorkerLimit(e),this}async detectSupportAsync(e){return this.workerConfig={astcSupported:await e.hasFeatureAsync("texture-compression-astc"),astcHDRSupported:!1,etc1Supported:await e.hasFeatureAsync("texture-compression-etc2"),etc2Supported:await e.hasFeatureAsync("texture-compression-etc2"),dxtSupported:await e.hasFeatureAsync("texture-compression-bc"),bptcSupported:await e.hasFeatureAsync("texture-compression-bc"),pvrtcSupported:await e.hasFeatureAsync("texture-compression-pvrtc")},this}detectSupport(e){return e.isWebGPURenderer===!0?this.workerConfig={astcSupported:e.hasFeature("texture-compression-astc"),astcHDRSupported:!1,etc1Supported:e.hasFeature("texture-compression-etc2"),etc2Supported:e.hasFeature("texture-compression-etc2"),dxtSupported:e.hasFeature("texture-compression-bc"),bptcSupported:e.hasFeature("texture-compression-bc"),pvrtcSupported:e.hasFeature("texture-compression-pvrtc")}:this.workerConfig={astcSupported:e.extensions.has("WEBGL_compressed_texture_astc"),astcHDRSupported:e.extensions.has("WEBGL_compressed_texture_astc")&&e.extensions.get("WEBGL_compressed_texture_astc").getSupportedProfiles().includes("hdr"),etc1Supported:e.extensions.has("WEBGL_compressed_texture_etc1"),etc2Supported:e.extensions.has("WEBGL_compressed_texture_etc"),dxtSupported:e.extensions.has("WEBGL_compressed_texture_s3tc"),bptcSupported:e.extensions.has("EXT_texture_compression_bptc"),pvrtcSupported:e.extensions.has("WEBGL_compressed_texture_pvrtc")||e.extensions.has("WEBKIT_WEBGL_compressed_texture_pvrtc")},this}init(){if(!this.transcoderPending){const e=new Lo(this.manager);e.setPath(this.transcoderPath),e.setWithCredentials(this.withCredentials);const t=e.loadAsync("basis_transcoder.js"),i=new Lo(this.manager);i.setPath(this.transcoderPath),i.setResponseType("arraybuffer"),i.setWithCredentials(this.withCredentials);const s=i.loadAsync("basis_transcoder.wasm");this.transcoderPending=Promise.all([t,s]).then(([r,o])=>{const a=Pn.BasisWorker.toString(),l=["/* constants */","let _EngineFormat = "+JSON.stringify(Pn.EngineFormat),"let _EngineType = "+JSON.stringify(Pn.EngineType),"let _TranscoderFormat = "+JSON.stringify(Pn.TranscoderFormat),"let _BasisFormat = "+JSON.stringify(Pn.BasisFormat),"/* basis_transcoder.js */",r,"/* worker */",a.substring(a.indexOf("{")+1,a.lastIndexOf("}"))].join(`
`);this.workerSourceURL=URL.createObjectURL(new Blob([l])),this.transcoderBinary=o,this.workerPool.setWorkerCreator(()=>{const c=new Worker(this.workerSourceURL),u=this.transcoderBinary.slice(0);return c.postMessage({type:"init",config:this.workerConfig,transcoderBinary:u},[u]),c})}),su>0&&console.warn("THREE.KTX2Loader: Multiple active KTX2 loaders may cause performance issues. Use a single KTX2Loader instance, or call .dispose() on old instances."),su++}return this.transcoderPending}load(e,t,i,s){if(this.workerConfig===null)throw new Error("THREE.KTX2Loader: Missing initialization with `.detectSupport( renderer )`.");const r=new Lo(this.manager);r.setPath(this.path),r.setCrossOrigin(this.crossOrigin),r.setWithCredentials(this.withCredentials),r.setResponseType("arraybuffer"),r.load(e,o=>{this.parse(o,t,s)},i,s)}parse(e,t,i){if(this.workerConfig===null)throw new Error("THREE.KTX2Loader: Missing initialization with `.detectSupport( renderer )`.");if(iu.has(e))return iu.get(e).promise.then(t).catch(i);this._createTexture(e).then(s=>t?t(s):null).catch(i)}_createTextureFrom(e,t){const{type:i,error:s,data:{faces:r,width:o,height:a,format:l,type:c,dfdFlags:u}}=e;if(i==="error")return Promise.reject(s);let h;if(t.faceCount===6)h=new P_(r,l,c);else{const d=r[0].mipmaps;h=t.layerCount>1?new D_(d,o,a,t.layerCount,l,c):new ql(d,o,a,l,c)}return h.minFilter=r[0].mipmaps.length===1?Jt:Gn,h.magFilter=Jt,h.generateMipmaps=!1,h.needsUpdate=!0,h.colorSpace=cg(t),h.premultiplyAlpha=!!(u&Rw),h}async _createTexture(e,t={}){const i=Uw(new Uint8Array(e)),s=i.vkFormat===Kh&&i.dataFormatDescriptor[0].colorModel===167;if(!(i.vkFormat===Pw||s&&!this.workerConfig.astcHDRSupported))return Qw(i);const o=t,a=this.init().then(()=>this.workerPool.postMessage({type:"transcode",buffer:e,taskConfig:o},[e])).then(l=>this._createTextureFrom(l.data,i));return iu.set(e,{promise:a}),a}dispose(){this.workerPool.dispose(),this.workerSourceURL&&URL.revokeObjectURL(this.workerSourceURL),su--}}Pn.BasisFormat={ETC1S:0,UASTC:1,UASTC_HDR:2};Pn.TranscoderFormat={ETC1:0,ETC2:1,BC1:2,BC3:3,BC4:4,BC5:5,BC7_M6_OPAQUE_ONLY:6,BC7_M5:7,PVRTC1_4_RGB:8,PVRTC1_4_RGBA:9,ASTC_4x4:10,ATC_RGB:11,ATC_RGBA_INTERPOLATED_ALPHA:12,RGBA32:13,RGB565:14,BGR565:15,RGBA4444:16,BC6H:22,RGB_HALF:24,RGBA_HALF:25};Pn.EngineFormat={RGBAFormat:Ht,RGBA_ASTC_4x4_Format:_s,RGB_BPTC_UNSIGNED_Format:vl,RGBA_BPTC_Format:Rr,RGBA_ETC2_EAC_Format:Vo,RGBA_PVRTC_4BPPV1_Format:Tr,RGBA_S3TC_DXT5_Format:Co,RGB_ETC1_Format:_l,RGB_ETC2_Format:zo,RGB_PVRTC_4BPPV1_Format:gl,RGBA_S3TC_DXT1_Format:gs};Pn.EngineType={UnsignedByteType:tt,HalfFloatType:Ln,FloatType:sn};Pn.BasisWorker=function(){let n,e,t;const i=_EngineFormat,s=_EngineType,r=_TranscoderFormat,o=_BasisFormat;self.addEventListener("message",function(A){const g=A.data;switch(g.type){case"init":n=g.config,a(g.transcoderBinary);break;case"transcode":e.then(()=>{try{const{faces:m,buffers:p,width:E,height:v,hasAlpha:_,format:x,type:S,dfdFlags:I}=l(g.buffer);self.postMessage({type:"transcode",id:g.id,data:{faces:m,width:E,height:v,hasAlpha:_,format:x,type:S,dfdFlags:I}},p)}catch(m){console.error(m),self.postMessage({type:"error",id:g.id,error:m.message})}});break}});function a(A){e=new Promise(g=>{t={wasmBinary:A,onRuntimeInitialized:g},BASIS(t)}).then(()=>{t.initializeBasis(),t.KTX2File===void 0&&console.warn("THREE.KTX2Loader: Please update Basis Universal transcoder.")})}function l(A){const g=new t.KTX2File(new Uint8Array(A));function m(){g.close(),g.delete()}if(!g.isValid())throw m(),new Error("THREE.KTX2Loader:	Invalid or unsupported .ktx2 file");let p;if(g.isUASTC())p=o.UASTC;else if(g.isETC1S())p=o.ETC1S;else if(g.isHDR())p=o.UASTC_HDR;else throw new Error("THREE.KTX2Loader: Unknown Basis encoding");const E=g.getWidth(),v=g.getHeight(),_=g.getLayers()||1,x=g.getLevels(),S=g.getFaces(),I=g.getHasAlpha(),L=g.getDFDFlags(),{transcoderFormat:y,engineFormat:b,engineType:R}=h(p,E,v,I);if(!E||!v||!x)throw m(),new Error("THREE.KTX2Loader:	Invalid texture");if(!g.startTranscoding())throw m(),new Error("THREE.KTX2Loader: .startTranscoding failed");const U=[],N=[];for(let G=0;G<S;G++){const V=[];for(let P=0;P<x;P++){const Y=[];let H,te;for(let ae=0;ae<_;ae++){const ve=g.getImageLevelInfo(P,ae,G);G===0&&P===0&&ae===0&&(ve.origWidth%4!==0||ve.origHeight%4!==0)&&console.warn("THREE.KTX2Loader: ETC1S and UASTC textures should use multiple-of-four dimensions."),x>1?(H=ve.origWidth,te=ve.origHeight):(H=ve.width,te=ve.height);let Oe=new Uint8Array(g.getImageTranscodedSizeInBytes(P,ae,0,y));const Ke=g.transcodeImage(Oe,P,ae,G,y,0,-1,-1);if(R===s.HalfFloatType&&(Oe=new Uint16Array(Oe.buffer,Oe.byteOffset,Oe.byteLength/Uint16Array.BYTES_PER_ELEMENT)),!Ke)throw m(),new Error("THREE.KTX2Loader: .transcodeImage failed.");Y.push(Oe)}const se=f(Y);V.push({data:se,width:H,height:te}),N.push(se.buffer)}U.push({mipmaps:V,width:E,height:v,format:b,type:R})}return m(),{faces:U,buffers:N,width:E,height:v,hasAlpha:I,dfdFlags:L,format:b,type:R}}const c=[{if:"astcSupported",basisFormat:[o.UASTC],transcoderFormat:[r.ASTC_4x4,r.ASTC_4x4],engineFormat:[i.RGBA_ASTC_4x4_Format,i.RGBA_ASTC_4x4_Format],engineType:[s.UnsignedByteType],priorityETC1S:1/0,priorityUASTC:1,needsPowerOfTwo:!1},{if:"bptcSupported",basisFormat:[o.ETC1S,o.UASTC],transcoderFormat:[r.BC7_M5,r.BC7_M5],engineFormat:[i.RGBA_BPTC_Format,i.RGBA_BPTC_Format],engineType:[s.UnsignedByteType],priorityETC1S:3,priorityUASTC:2,needsPowerOfTwo:!1},{if:"dxtSupported",basisFormat:[o.ETC1S,o.UASTC],transcoderFormat:[r.BC1,r.BC3],engineFormat:[i.RGBA_S3TC_DXT1_Format,i.RGBA_S3TC_DXT5_Format],engineType:[s.UnsignedByteType],priorityETC1S:4,priorityUASTC:5,needsPowerOfTwo:!1},{if:"etc2Supported",basisFormat:[o.ETC1S,o.UASTC],transcoderFormat:[r.ETC1,r.ETC2],engineFormat:[i.RGB_ETC2_Format,i.RGBA_ETC2_EAC_Format],engineType:[s.UnsignedByteType],priorityETC1S:1,priorityUASTC:3,needsPowerOfTwo:!1},{if:"etc1Supported",basisFormat:[o.ETC1S,o.UASTC],transcoderFormat:[r.ETC1],engineFormat:[i.RGB_ETC1_Format],engineType:[s.UnsignedByteType],priorityETC1S:2,priorityUASTC:4,needsPowerOfTwo:!1},{if:"pvrtcSupported",basisFormat:[o.ETC1S,o.UASTC],transcoderFormat:[r.PVRTC1_4_RGB,r.PVRTC1_4_RGBA],engineFormat:[i.RGB_PVRTC_4BPPV1_Format,i.RGBA_PVRTC_4BPPV1_Format],engineType:[s.UnsignedByteType],priorityETC1S:5,priorityUASTC:6,needsPowerOfTwo:!0},{if:"bptcSupported",basisFormat:[o.UASTC_HDR],transcoderFormat:[r.BC6H],engineFormat:[i.RGB_BPTC_UNSIGNED_Format],engineType:[s.HalfFloatType],priorityHDR:1,needsPowerOfTwo:!1},{basisFormat:[o.ETC1S,o.UASTC],transcoderFormat:[r.RGBA32,r.RGBA32],engineFormat:[i.RGBAFormat,i.RGBAFormat],engineType:[s.UnsignedByteType,s.UnsignedByteType],priorityETC1S:100,priorityUASTC:100,needsPowerOfTwo:!1},{basisFormat:[o.UASTC_HDR],transcoderFormat:[r.RGBA_HALF],engineFormat:[i.RGBAFormat],engineType:[s.HalfFloatType],priorityHDR:100,needsPowerOfTwo:!1}],u={[o.ETC1S]:c.filter(A=>A.basisFormat.includes(o.ETC1S)).sort((A,g)=>A.priorityUASTC-g.priorityUASTC),[o.UASTC]:c.filter(A=>A.basisFormat.includes(o.UASTC)).sort((A,g)=>A.priorityUASTC-g.priorityUASTC),[o.UASTC_HDR]:c.filter(A=>A.basisFormat.includes(o.UASTC_HDR)).sort((A,g)=>A.priorityHDR-g.priorityHDR)};function h(A,g,m,p){const E=u[A];for(let v=0;v<E.length;v++){const _=E[v];if(_.if&&!n[_.if]||!_.basisFormat.includes(A)||p&&_.transcoderFormat.length<2||_.needsPowerOfTwo&&!(d(g)&&d(m)))continue;const x=_.transcoderFormat[p?1:0],S=_.engineFormat[p?1:0],I=_.engineType[0];return{transcoderFormat:x,engineFormat:S,engineType:I}}throw new Error("THREE.KTX2Loader: Failed to identify transcoding target.")}function d(A){return A<=2?!0:(A&A-1)===0&&A!==0}function f(A){if(A.length===1)return A[0];let g=0;for(let E=0;E<A.length;E++){const v=A[E];g+=v.byteLength}const m=new Uint8Array(g);let p=0;for(let E=0;E<A.length;E++){const v=A[E];m.set(v,p),p+=v.byteLength}return m}};const kw=new Set([Ht,ko,ds,Oi]),ou={[Nm]:Ht,[Fm]:ds,[Um]:Oi,[Pm]:Ht,[Dm]:ds,[Lm]:Oi,[Bm]:Ht,[Rm]:Ht,[Tm]:ds,[Im]:ds,[Cm]:Oi,[wm]:Oi,[km]:ko,[Om]:ko,[$m]:Vo,[Zm]:zo,[Kh]:_s,[tg]:_s,[eg]:_s,[lg]:Er,[ig]:Er,[ng]:Er,[zm]:gs,[Gm]:gs,[Hm]:vr,[Qm]:vr,[Wm]:xr,[Vm]:xr,[Xm]:El,[qm]:xl,[jm]:yl,[Ym]:bl,[Km]:Rr,[Jm]:Rr,[ag]:Tr,[rg]:Tr,[og]:Go,[sg]:Go},ir={[Nm]:sn,[Fm]:sn,[Um]:sn,[Pm]:Ln,[Dm]:Ln,[Lm]:Ln,[Bm]:tt,[Rm]:tt,[Tm]:tt,[Im]:tt,[Cm]:tt,[wm]:tt,[km]:Ql,[Om]:Hl,[$m]:tt,[Zm]:tt,[Kh]:Ln,[tg]:tt,[eg]:tt,[lg]:Ln,[ig]:tt,[ng]:tt,[zm]:tt,[Gm]:tt,[Hm]:tt,[Qm]:tt,[Wm]:tt,[Vm]:tt,[Xm]:tt,[qm]:tt,[jm]:tt,[Ym]:tt,[Km]:tt,[Jm]:tt,[ag]:tt,[rg]:tt,[og]:tt,[sg]:tt};async function Qw(n){const{vkFormat:e}=n;if(ou[e]===void 0)throw new Error("THREE.KTX2Loader: Unsupported vkFormat: "+e);ir[e]===void 0&&console.warn('THREE.KTX2Loader: Missing ".type" for vkFormat: '+e);let t;n.supercompressionScheme===op&&(ru||(ru=new Promise(async o=>{const a=new Fw;await a.init(),o(a)})),t=await ru);const i=[];for(let o=0;o<n.levels.length;o++){const a=Math.max(1,n.pixelWidth>>o),l=Math.max(1,n.pixelHeight>>o),c=n.pixelDepth?Math.max(1,n.pixelDepth>>o):0,u=n.levels[o];let h;if(n.supercompressionScheme===Tw)h=u.levelData;else if(n.supercompressionScheme===op)h=t.decode(u.levelData,u.uncompressedByteLength);else throw new Error("THREE.KTX2Loader: Unsupported supercompressionScheme.");let d;ir[e]===sn?d=new Float32Array(h.buffer,h.byteOffset,h.byteLength/Float32Array.BYTES_PER_ELEMENT):ir[e]===Ln?d=new Uint16Array(h.buffer,h.byteOffset,h.byteLength/Uint16Array.BYTES_PER_ELEMENT):ir[e]===Ql||ir[e]===Hl?d=new Uint32Array(h.buffer,h.byteOffset,h.byteLength/Uint32Array.BYTES_PER_ELEMENT):d=h,i.push({data:d,width:a,height:l,depth:c})}const s=n.levelCount===0||i.length>1;let r;if(kw.has(ou[e]))r=n.pixelDepth===0?new Vl(i[0].data,n.pixelWidth,n.pixelHeight):new EA(i[0].data,n.pixelWidth,n.pixelHeight,n.pixelDepth),r.minFilter=s?xh:Gt,r.magFilter=Gt,r.generateMipmaps=n.levelCount===0;else{if(n.pixelDepth>0)throw new Error("THREE.KTX2Loader: Unsupported pixelDepth.");r=new ql(i,n.pixelWidth,n.pixelHeight),r.minFilter=s?Gn:Jt,r.magFilter=Jt}return r.mipmaps=i,r.type=ir[e],r.format=ou[e],r.colorSpace=cg(n),r.needsUpdate=!0,Promise.resolve(r)}function cg(n){const e=n.dataFormatDescriptor[0];return e.colorPrimaries===Lw?e.transferFunction===ap?Bt:rn:e.colorPrimaries===Dw?e.transferFunction===ap?Nw:Ow:(e.colorPrimaries===Bw||console.warn(`THREE.KTX2Loader: Unsupported color primaries, "${e.colorPrimaries}"`),ti)}var Hw=(function(){var n="b9H79Tebbbe8Fv9Gbb9Gvuuuuueu9Giuuub9Geueu9Giuuueuikqbeeedddillviebeoweuec:q:Odkr;leDo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbeY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVbdE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbiL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtblK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949Wbol79IV9Rbrq;w8Wqdbk;esezu8Jjjjjbcj;eb9Rgv8Kjjjjbc9:hodnadcefal0mbcuhoaiRbbc:Ge9hmbavaialfgrad9Radz1jjjbhwcj;abad9Uc;WFbGgocjdaocjd6EhDaicefhocbhqdnindndndnaeaq9nmbaDaeaq9RaqaDfae6Egkcsfglcl4cifcd4hxalc9WGgmTmecbhPawcjdfhsaohzinaraz9Rax6mvarazaxfgo9RcK6mvczhlcbhHinalgic9WfgOawcj;cbffhldndndndndnazaOco4fRbbaHcoG4ciGPlbedibkal9cb83ibalcwf9cb83ibxikalaoRblaoRbbgOco4gAaAciSgAE86bbawcj;cbfaifglcGfaoclfaAfgARbbaOcl4ciGgCaCciSgCE86bbalcVfaAaCfgARbbaOcd4ciGgCaCciSgCE86bbalc7faAaCfgARbbaOciGgOaOciSgOE86bbalctfaAaOfgARbbaoRbegOco4gCaCciSgCE86bbalc91faAaCfgARbbaOcl4ciGgCaCciSgCE86bbalc4faAaCfgARbbaOcd4ciGgCaCciSgCE86bbalc93faAaCfgARbbaOciGgOaOciSgOE86bbalc94faAaOfgARbbaoRbdgOco4gCaCciSgCE86bbalc95faAaCfgARbbaOcl4ciGgCaCciSgCE86bbalc96faAaCfgARbbaOcd4ciGgCaCciSgCE86bbalc97faAaCfgARbbaOciGgOaOciSgOE86bbalc98faAaOfgORbbaoRbigoco4gAaAciSgAE86bbalc99faOaAfgORbbaocl4ciGgAaAciSgAE86bbalc9:faOaAfgORbbaocd4ciGgAaAciSgAE86bbalcufaOaAfglRbbaociGgoaociSgoE86bbalaofhoxdkalaoRbwaoRbbgOcl4gAaAcsSgAE86bbawcj;cbfaifglcGfaocwfaAfgARbbaOcsGgOaOcsSgOE86bbalcVfaAaOfgORbbaoRbegAcl4gCaCcsSgCE86bbalc7faOaCfgORbbaAcsGgAaAcsSgAE86bbalctfaOaAfgORbbaoRbdgAcl4gCaCcsSgCE86bbalc91faOaCfgORbbaAcsGgAaAcsSgAE86bbalc4faOaAfgORbbaoRbigAcl4gCaCcsSgCE86bbalc93faOaCfgORbbaAcsGgAaAcsSgAE86bbalc94faOaAfgORbbaoRblgAcl4gCaCcsSgCE86bbalc95faOaCfgORbbaAcsGgAaAcsSgAE86bbalc96faOaAfgORbbaoRbvgAcl4gCaCcsSgCE86bbalc97faOaCfgORbbaAcsGgAaAcsSgAE86bbalc98faOaAfgORbbaoRbogAcl4gCaCcsSgCE86bbalc99faOaCfgORbbaAcsGgAaAcsSgAE86bbalc9:faOaAfgORbbaoRbrgocl4gAaAcsSgAE86bbalcufaOaAfglRbbaocsGgoaocsSgoE86bbalaofhoxekalao8Pbb83bbalcwfaocwf8Pbb83bbaoczfhokdnaiam9pmbaHcdfhHaiczfhlarao9RcL0mekkaiam6mvaoTmvdnakTmbawaPfRbbhHawcj;cbfhlashiakhOinaialRbbgzce4cbazceG9R7aHfgH86bbaiadfhialcefhlaOcufgOmbkkascefhsaohzaPcefgPad9hmbxikkcbc99arao9Radcaadca0ESEhoxlkaoaxad2fhCdnakmbadhlinaoTmlarao9Rax6mlaoaxfhoalcufglmbkaChoxekcbhmawcjdfhAinarao9Rax6miawamfRbbhHawcj;cbfhlaAhiakhOinaialRbbgzce4cbazceG9R7aHfgH86bbaiadfhialcefhlaOcufgOmbkaAcefhAaoaxfhoamcefgmad9hmbkaChokabaqad2fawcjdfakad2z1jjjb8Aawawcjdfakcufad2fadz1jjjb8Aakaqfhqaombkc9:hoxekc9:hokavcj;ebf8Kjjjjbaok;cseHu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnaeci9UgrcHfal0mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgwce0mbavc;abfcFecjez:jjjjb8AavcUf9cu83ibavc8Wf9cu83ibavcyf9cu83ibavcaf9cu83ibavcKf9cu83ibavczf9cu83ibav9cu83iwav9cu83ibaialfc9WfhDaicefgqarfhidnaeTmbcmcsawceSEhkcbhxcbhmcbhPcbhwcbhlindnaiaD9nmbc9:hoxikdndnaqRbbgoc;Ve0mbavc;abfalaocu7gscl4fcsGcitfgzydlhrazydbhzdnaocsGgHak9pmbavawasfcsGcdtfydbaxaHEhoaHThsdndnadcd9hmbabaPcetfgHaz87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHazBdbaHcwfaoBdbaHclfarBdbkaxasfhxcdhHavawcdtfaoBdbawasfhwcehsalhOxdkdndnaHcsSmbaHc987aHamffcefhoxekaicefhoai8SbbgHcFeGhsdndnaHcu9mmbaohixekaicvfhiascFbGhscrhHdninao8SbbgOcFbGaHtasVhsaOcu9kmeaocefhoaHcrfgHc8J9hmbxdkkaocefhikasce4cbasceG9R7amfhokdndnadcd9hmbabaPcetfgHaz87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHazBdbaHcwfaoBdbaHclfarBdbkcdhHavawcdtfaoBdbcehsawcefhwalhOaohmxekdnaocpe0mbaxcefgHavawaDaocsGfRbbgocl49RcsGcdtfydbaocz6gzEhravawao9RcsGcdtfydbaHazfgAaocsGgHEhoaHThCdndnadcd9hmbabaPcetfgHax87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHaxBdbaHcwfaoBdbaHclfarBdbkcdhsavawcdtfaxBdbavawcefgwcsGcdtfarBdbcihHavc;abfalcitfgOaxBdlaOarBdbavawazfgwcsGcdtfaoBdbalcefcsGhOawaCfhwaxhzaAaCfhxxekaxcbaiRbbgOEgzaoc;:eSgHfhraOcsGhCaOcl4hAdndnaOcs0mbarcefhoxekarhoavawaA9RcsGcdtfydbhrkdndnaCmbaocefhxxekaohxavawaO9RcsGcdtfydbhokdndnaHTmbaicefhHxekaicdfhHai8SbegscFeGhzdnascu9kmbaicofhXazcFbGhzcrhidninaH8SbbgscFbGaitazVhzascu9kmeaHcefhHaicrfgic8J9hmbkaXhHxekaHcefhHkazce4cbazceG9R7amfgmhzkdndnaAcsSmbaHhsxekaHcefhsaH8SbbgicFeGhrdnaicu9kmbaHcvfhXarcFbGhrcrhidninas8SbbgHcFbGaitarVhraHcu9kmeascefhsaicrfgic8J9hmbkaXhsxekascefhskarce4cbarceG9R7amfgmhrkdndnaCcsSmbashixekascefhias8SbbgocFeGhHdnaocu9kmbascvfhXaHcFbGhHcrhodninai8SbbgscFbGaotaHVhHascu9kmeaicefhiaocrfgoc8J9hmbkaXhixekaicefhikaHce4cbaHceG9R7amfgmhokdndnadcd9hmbabaPcetfgHaz87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHazBdbaHcwfaoBdbaHclfarBdbkcdhsavawcdtfazBdbavawcefgwcsGcdtfarBdbcihHavc;abfalcitfgXazBdlaXarBdbavawaOcz6aAcsSVfgwcsGcdtfaoBdbawaCTaCcsSVfhwalcefcsGhOkaqcefhqavc;abfaOcitfgOarBdlaOaoBdbavc;abfalasfcsGcitfgraoBdlarazBdbawcsGhwalaHfcsGhlaPcifgPae6mbkkcbc99aiaDSEhokavc;aef8Kjjjjbaok:flevu8Jjjjjbcz9Rhvc9:hodnaecvfal0mbcuhoaiRbbc;:eGc;qe9hmbav9cb83iwaicefhraialfc98fhwdnaeTmbdnadcdSmbcbhDindnaraw6mbc9:skarcefhoar8SbbglcFeGhidndnalcu9mmbaohrxekarcvfhraicFbGhicrhldninao8SbbgdcFbGaltaiVhiadcu9kmeaocefhoalcrfglc8J9hmbxdkkaocefhrkabaDcdtfaic8Etc8F91aicd47avcwfaiceGcdtVgoydbfglBdbaoalBdbaDcefgDae9hmbxdkkcbhDindnaraw6mbc9:skarcefhoar8SbbglcFeGhidndnalcu9mmbaohrxekarcvfhraicFbGhicrhldninao8SbbgdcFbGaltaiVhiadcu9kmeaocefhoalcrfglc8J9hmbxdkkaocefhrkabaDcetfaic8Etc8F91aicd47avcwfaiceGcdtVgoydbfgl87ebaoalBdbaDcefgDae9hmbkkcbc99arawSEhokaok:Lvoeue99dud99eud99dndnadcl9hmbaeTmeindndnabcdfgd8Sbb:Yab8Sbbgi:Ygl:l:tabcefgv8Sbbgo:Ygr:l:tgwJbb;:9cawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai86bbdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad86bbdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad86bbabclfhbaecufgembxdkkaeTmbindndnabclfgd8Ueb:Yab8Uebgi:Ygl:l:tabcdfgv8Uebgo:Ygr:l:tgwJb;:FSawawNJbbbbawawJbbbb9GgDEgq:mgkaqaicb9iEalMgwawNakaqaocb9iEarMgqaqNMM:r:vglNJbbbZJbbb:;aDEMgr:lJbbb9p9DTmbar:Ohixekcjjjj94hikadai87ebdndnaqalNJbbbZJbbb:;aqJbbbb9GEMgq:lJbbb9p9DTmbaq:Ohdxekcjjjj94hdkavad87ebdndnawalNJbbbZJbbb:;awJbbbb9GEMgw:lJbbb9p9DTmbaw:Ohdxekcjjjj94hdkabad87ebabcwfhbaecufgembkkk;oiliui99iue99dnaeTmbcbhiabhlindndnJ;Zl81Zalcof8UebgvciV:Y:vgoal8Ueb:YNgrJb;:FSNJbbbZJbbb:;arJbbbb9GEMgw:lJbbb9p9DTmbaw:OhDxekcjjjj94hDkalclf8Uebhqalcdf8UebhkabaiavcefciGfcetfaD87ebdndnaoak:YNgwJb;:FSNJbbbZJbbb:;awJbbbb9GEMgx:lJbbb9p9DTmbax:OhDxekcjjjj94hDkabaiavciGfgkcd7cetfaD87ebdndnaoaq:YNgoJb;:FSNJbbbZJbbb:;aoJbbbb9GEMgx:lJbbb9p9DTmbax:OhDxekcjjjj94hDkabaiavcufciGfcetfaD87ebdndnJbbjZararN:tawawN:taoaoN:tgrJbbbbarJbbbb9GE:rJb;:FSNJbbbZMgr:lJbbb9p9DTmbar:Ohvxekcjjjj94hvkabakcetfav87ebalcwfhlaiclfhiaecufgembkkk9mbdnadcd4ae2gdTmbinababydbgecwtcw91:Yaece91cjjj98Gcjjj;8if::NUdbabclfhbadcufgdmbkkk9teiucbcbydj1jjbgeabcifc98GfgbBdj1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaik;LeeeudndnaeabVciGTmbabhixekdndnadcz9pmbabhixekabhiinaiaeydbBdbaiclfaeclfydbBdbaicwfaecwfydbBdbaicxfaecxfydbBdbaeczfheaiczfhiadc9Wfgdcs0mbkkadcl6mbinaiaeydbBdbaeclfheaiclfhiadc98fgdci0mbkkdnadTmbinaiaeRbb86bbaicefhiaecefheadcufgdmbkkabk;aeedudndnabciGTmbabhixekaecFeGc:b:c:ew2hldndnadcz9pmbabhixekabhiinaialBdbaicxfalBdbaicwfalBdbaiclfalBdbaiczfhiadc9Wfgdcs0mbkkadcl6mbinaialBdbaiclfhiadc98fgdci0mbkkdnadTmbinaiae86bbaicefhiadcufgdmbkkabkkkebcjwklzNbb",e="b9H79TebbbeKl9Gbb9Gvuuuuueu9Giuuub9Geueuikqbbebeedddilve9Weeeviebeoweuec:q:6dkr;leDo9TW9T9VV95dbH9F9F939H79T9F9J9H229F9Jt9VV7bb8A9TW79O9V9Wt9F9KW9J9V9KW9wWVtW949c919M9MWVbdY9TW79O9V9Wt9F9KW9J9V9KW69U9KW949c919M9MWVblE9TW79O9V9Wt9F9KW9J9V9KW69U9KW949tWG91W9U9JWbvL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9p9JtboK9TW79O9V9Wt9F9KW9J9V9KWS9P2tWV9r919HtbrL9TW79O9V9Wt9F9KW9J9V9KWS9P2tWVT949Wbwl79IV9RbDq:p9sqlbzik9:evu8Jjjjjbcz9Rhbcbheincbhdcbhiinabcwfadfaicjuaead4ceGglE86bbaialfhiadcefgdcw9hmbkaec:q:yjjbfai86bbaecitc:q1jjbfab8Piw83ibaecefgecjd9hmbkk:N8JlHud97euo978Jjjjjbcj;kb9Rgv8Kjjjjbc9:hodnadcefal0mbcuhoaiRbbc:Ge9hmbavaialfgrad9Rad;8qbbcj;abad9UhlaicefhodnaeTmbadTmbalc;WFbGglcjdalcjd6EhwcbhDinawaeaD9RaDawfae6Egqcsfglc9WGgkci2hxakcethmalcl4cifcd4hPabaDad2fhsakc;ab6hzcbhHincbhOaohAdndninaraA9RaP6meavcj;cbfaOak2fhCaAaPfhocbhidnazmbarao9Rc;Gb6mbcbhlinaCalfhidndndndndnaAalco4fRbbgXciGPlbedibkaipxbbbbbbbbbbbbbbbbpklbxikaiaopbblaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklbaoclfaYpQbfaKc:q:yjjbfRbbfhoxdkaiaopbbwaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklbaocwfaYpQbfaKc:q:yjjbfRbbfhoxekaiaopbbbpklbaoczfhokdndndndndnaXcd4ciGPlbedibkaipxbbbbbbbbbbbbbbbbpklzxikaiaopbblaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklzaoclfaYpQbfaKc:q:yjjbfRbbfhoxdkaiaopbbwaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklzaocwfaYpQbfaKc:q:yjjbfRbbfhoxekaiaopbbbpklzaoczfhokdndndndndnaXcl4ciGPlbedibkaipxbbbbbbbbbbbbbbbbpklaxikaiaopbblaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklaaoclfaYpQbfaKc:q:yjjbfRbbfhoxdkaiaopbbwaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spklaaocwfaYpQbfaKc:q:yjjbfRbbfhoxekaiaopbbbpklaaoczfhokdndndndndnaXco4Plbedibkaipxbbbbbbbbbbbbbbbbpkl8WxikaiaopbblaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgXcitc:q1jjbfpbibaXc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgXcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spkl8WaoclfaYpQbfaXc:q:yjjbfRbbfhoxdkaiaopbbwaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgXcitc:q1jjbfpbibaXc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgXcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spkl8WaocwfaYpQbfaXc:q:yjjbfRbbfhoxekaiaopbbbpkl8Waoczfhokalc;abfhialcjefak0meaihlarao9Rc;Fb0mbkkdnaiak9pmbaici4hlinarao9RcK6miaCaifhXdndndndndnaAaico4fRbbalcoG4ciGPlbedibkaXpxbbbbbbbbbbbbbbbbpkbbxikaXaopbblaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLgQcdp:meaQpmbzeHdOiAlCvXoQrLpxiiiiiiiiiiiiiiiip9ogLpxiiiiiiiiiiiiiiiip8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spkbbaoclfaYpQbfaKc:q:yjjbfRbbfhoxdkaXaopbbwaopbbbgQclp:meaQpmbzeHdOiAlCvXoQrLpxssssssssssssssssp9ogLpxssssssssssssssssp8JgQp5b9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibaKc:q:yjjbfpbbbgYaYpmbbbbbbbbbbbbbbbbaQp5e9cjF;8;4;W;G;ab9:9cU1:NgKcitc:q1jjbfpbibp9UpmbedilvorzHOACXQLpPaLaQp9spkbbaocwfaYpQbfaKc:q:yjjbfRbbfhoxekaXaopbbbpkbbaoczfhokalcdfhlaiczfgiak6mbkkaoTmeaohAaOcefgOclSmdxbkkc9:hoxlkdnakTmbavcjdfaHfhiavaHfpbdbhYcbhXinaiavcj;cbfaXfglpblbgLcep9TaLpxeeeeeeeeeeeeeeeegQp9op9Hp9rgLalakfpblbg8Acep9Ta8AaQp9op9Hp9rg8ApmbzeHdOiAlCvXoQrLgEalamfpblbg3cep9Ta3aQp9op9Hp9rg3alaxfpblbg5cep9Ta5aQp9op9Hp9rg5pmbzeHdOiAlCvXoQrLg8EpmbezHdiOAlvCXorQLgQaQpmbedibedibedibediaYp9UgYp9AdbbaiadfglaYaQaQpmlvorlvorlvorlvorp9UgYp9AdbbaladfglaYaQaQpmwDqkwDqkwDqkwDqkp9UgYp9AdbbaladfglaYaQaQpmxmPsxmPsxmPsxmPsp9UgYp9AdbbaladfglaYaEa8EpmwDKYqk8AExm35Ps8E8FgQaQpmbedibedibedibedip9UgYp9AdbbaladfglaYaQaQpmlvorlvorlvorlvorp9UgYp9AdbbaladfglaYaQaQpmwDqkwDqkwDqkwDqkp9UgYp9AdbbaladfglaYaQaQpmxmPsxmPsxmPsxmPsp9UgYp9AdbbaladfglaYaLa8ApmwKDYq8AkEx3m5P8Es8FgLa3a5pmwKDYq8AkEx3m5P8Es8Fg8ApmbezHdiOAlvCXorQLgQaQpmbedibedibedibedip9UgYp9AdbbaladfglaYaQaQpmlvorlvorlvorlvorp9UgYp9AdbbaladfglaYaQaQpmwDqkwDqkwDqkwDqkp9UgYp9AdbbaladfglaYaQaQpmxmPsxmPsxmPsxmPsp9UgYp9AdbbaladfglaYaLa8ApmwDKYqk8AExm35Ps8E8FgQaQpmbedibedibedibedip9UgYp9AdbbaladfglaYaQaQpmlvorlvorlvorlvorp9UgYp9AdbbaladfglaYaQaQpmwDqkwDqkwDqkwDqkp9UgYp9AdbbaladfglaYaQaQpmxmPsxmPsxmPsxmPsp9UgYp9AdbbaladfhiaXczfgXak6mbkkaHclfgHad6mbkasavcjdfaqad2;8qbbavavcjdfaqcufad2fad;8qbbaqaDfgDae6mbkkcbc99arao9Radcaadca0ESEhokavcj;kbf8Kjjjjbaokwbz:bjjjbk::seHu8Jjjjjbc;ae9Rgv8Kjjjjbc9:hodnaeci9UgrcHfal0mbcuhoaiRbbgwc;WeGc;Ge9hmbawcsGgwce0mbavc;abfcFecje;8kbavcUf9cu83ibavc8Wf9cu83ibavcyf9cu83ibavcaf9cu83ibavcKf9cu83ibavczf9cu83ibav9cu83iwav9cu83ibaialfc9WfhDaicefgqarfhidnaeTmbcmcsawceSEhkcbhxcbhmcbhPcbhwcbhlindnaiaD9nmbc9:hoxikdndnaqRbbgoc;Ve0mbavc;abfalaocu7gscl4fcsGcitfgzydlhrazydbhzdnaocsGgHak9pmbavawasfcsGcdtfydbaxaHEhoaHThsdndnadcd9hmbabaPcetfgHaz87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHazBdbaHcwfaoBdbaHclfarBdbkaxasfhxcdhHavawcdtfaoBdbawasfhwcehsalhOxdkdndnaHcsSmbaHc987aHamffcefhoxekaicefhoai8SbbgHcFeGhsdndnaHcu9mmbaohixekaicvfhiascFbGhscrhHdninao8SbbgOcFbGaHtasVhsaOcu9kmeaocefhoaHcrfgHc8J9hmbxdkkaocefhikasce4cbasceG9R7amfhokdndnadcd9hmbabaPcetfgHaz87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHazBdbaHcwfaoBdbaHclfarBdbkcdhHavawcdtfaoBdbcehsawcefhwalhOaohmxekdnaocpe0mbaxcefgHavawaDaocsGfRbbgocl49RcsGcdtfydbaocz6gzEhravawao9RcsGcdtfydbaHazfgAaocsGgHEhoaHThCdndnadcd9hmbabaPcetfgHax87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHaxBdbaHcwfaoBdbaHclfarBdbkcdhsavawcdtfaxBdbavawcefgwcsGcdtfarBdbcihHavc;abfalcitfgOaxBdlaOarBdbavawazfgwcsGcdtfaoBdbalcefcsGhOawaCfhwaxhzaAaCfhxxekaxcbaiRbbgOEgzaoc;:eSgHfhraOcsGhCaOcl4hAdndnaOcs0mbarcefhoxekarhoavawaA9RcsGcdtfydbhrkdndnaCmbaocefhxxekaohxavawaO9RcsGcdtfydbhokdndnaHTmbaicefhHxekaicdfhHai8SbegscFeGhzdnascu9kmbaicofhXazcFbGhzcrhidninaH8SbbgscFbGaitazVhzascu9kmeaHcefhHaicrfgic8J9hmbkaXhHxekaHcefhHkazce4cbazceG9R7amfgmhzkdndnaAcsSmbaHhsxekaHcefhsaH8SbbgicFeGhrdnaicu9kmbaHcvfhXarcFbGhrcrhidninas8SbbgHcFbGaitarVhraHcu9kmeascefhsaicrfgic8J9hmbkaXhsxekascefhskarce4cbarceG9R7amfgmhrkdndnaCcsSmbashixekascefhias8SbbgocFeGhHdnaocu9kmbascvfhXaHcFbGhHcrhodninai8SbbgscFbGaotaHVhHascu9kmeaicefhiaocrfgoc8J9hmbkaXhixekaicefhikaHce4cbaHceG9R7amfgmhokdndnadcd9hmbabaPcetfgHaz87ebaHclfao87ebaHcdfar87ebxekabaPcdtfgHazBdbaHcwfaoBdbaHclfarBdbkcdhsavawcdtfazBdbavawcefgwcsGcdtfarBdbcihHavc;abfalcitfgXazBdlaXarBdbavawaOcz6aAcsSVfgwcsGcdtfaoBdbawaCTaCcsSVfhwalcefcsGhOkaqcefhqavc;abfaOcitfgOarBdlaOaoBdbavc;abfalasfcsGcitfgraoBdlarazBdbawcsGhwalaHfcsGhlaPcifgPae6mbkkcbc99aiaDSEhokavc;aef8Kjjjjbaok:flevu8Jjjjjbcz9Rhvc9:hodnaecvfal0mbcuhoaiRbbc;:eGc;qe9hmbav9cb83iwaicefhraialfc98fhwdnaeTmbdnadcdSmbcbhDindnaraw6mbc9:skarcefhoar8SbbglcFeGhidndnalcu9mmbaohrxekarcvfhraicFbGhicrhldninao8SbbgdcFbGaltaiVhiadcu9kmeaocefhoalcrfglc8J9hmbxdkkaocefhrkabaDcdtfaic8Etc8F91aicd47avcwfaiceGcdtVgoydbfglBdbaoalBdbaDcefgDae9hmbxdkkcbhDindnaraw6mbc9:skarcefhoar8SbbglcFeGhidndnalcu9mmbaohrxekarcvfhraicFbGhicrhldninao8SbbgdcFbGaltaiVhiadcu9kmeaocefhoalcrfglc8J9hmbxdkkaocefhrkabaDcetfaic8Etc8F91aicd47avcwfaiceGcdtVgoydbfgl87ebaoalBdbaDcefgDae9hmbkkcbc99arawSEhokaok:wPliuo97eue978Jjjjjbca9Rhiaec98Ghldndnadcl9hmbdnalTmbcbhvabhdinadadpbbbgocKp:RecKp:Sep;6egraocwp:RecKp:Sep;6earp;Geaoczp:RecKp:Sep;6egwp;Gep;Kep;LegDpxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgkp9op9rp;Kegrpxbb;:9cbb;:9cbb;:9cbb;:9cararp;MeaDaDp;Meawaqawakp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFbbbFbbbFbbbFbbbp9oaopxbbbFbbbFbbbFbbbFp9op9qarawp;Meaqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaDawp;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpkbbadczfhdavclfgval6mbkkalaeSmeaipxbbbbbbbbbbbbbbbbgqpklbaiabalcdtfgdaeciGglcdtgv;8qbbdnalTmbaiaipblbgocKp:RecKp:Sep;6egraocwp:RecKp:Sep;6earp;Geaoczp:RecKp:Sep;6egwp;Gep;Kep;LegDaqp:2egqarpxbbbjbbbjbbbjbbbjgkp9op9rp;Kegrpxbb;:9cbb;:9cbb;:9cbb;:9cararp;MeaDaDp;Meawaqawakp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFbbbFbbbFbbbFbbbp9oaopxbbbFbbbFbbbFbbbFp9op9qarawp;Meaqp;Kecwp:RepxbFbbbFbbbFbbbFbbp9op9qaDawp;Meaqp;Keczp:RepxbbFbbbFbbbFbbbFbp9op9qpklbkadaiav;8qbbskdnalTmbcbhvabhdinadczfgxaxpbbbgopxbbbbbbFFbbbbbbFFgkp9oadpbbbgDaopmbediwDqkzHOAKY8AEgwczp:Reczp:Sep;6egraDaopmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;6eawczp:Sep;6egwp;Gearp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgmp9op9rp;Kegrpxb;:FSb;:FSb;:FSb;:FSararp;Meaoaop;Meawaqawamp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFFbbFFbbFFbbFFbbp9oaoawp;Meaqp;Keczp:Rep9qgoarawp;Meaqp;KepxFFbbFFbbFFbbFFbbp9ogrpmwDKYqk8AExm35Ps8E8Fp9qpkbbadaDakp9oaoarpmbezHdiOAlvCXorQLp9qpkbbadcafhdavclfgval6mbkkalaeSmbaiaeciGgvcitgdfcbcaad9R;8kbaiabalcitfglad;8qbbdnavTmbaiaipblzgopxbbbbbbFFbbbbbbFFgkp9oaipblbgDaopmbediwDqkzHOAKY8AEgwczp:Reczp:Sep;6egraDaopmlvorxmPsCXQL358E8FpxFubbFubbFubbFubbp9op;6eawczp:Sep;6egwp;Gearp;Gep;Kep;Legopxbbbbbbbbbbbbbbbbp:2egqarpxbbbjbbbjbbbjbbbjgmp9op9rp;Kegrpxb;:FSb;:FSb;:FSb;:FSararp;Meaoaop;Meawaqawamp9op9rp;Kegrarp;Mep;Kep;Kep;Jep;Negwp;Mepxbbn0bbn0bbn0bbn0gqp;KepxFFbbFFbbFFbbFFbbp9oaoawp;Meaqp;Keczp:Rep9qgoarawp;Meaqp;KepxFFbbFFbbFFbbFFbbp9ogrpmwDKYqk8AExm35Ps8E8Fp9qpklzaiaDakp9oaoarpmbezHdiOAlvCXorQLp9qpklbkalaiad;8qbbkk;4wllue97euv978Jjjjjbc8W9Rhidnaec98GglTmbcbhvabhoinaiaopbbbgraoczfgwpbbbgDpmlvorxmPsCXQL358E8Fgqczp:Segkclp:RepklbaopxbbjZbbjZbbjZbbjZpx;Zl81Z;Zl81Z;Zl81Z;Zl81Zakpxibbbibbbibbbibbbp9qp;6ep;NegkaraDpmbediwDqkzHOAKY8AEgrczp:Reczp:Sep;6ep;MegDaDp;Meakarczp:Sep;6ep;Megxaxp;Meakaqczp:Reczp:Sep;6ep;Megqaqp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jepxb;:FSb;:FSb;:FSb;:FSgkp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbgmp9oaxakp;Mearp;Keczp:Rep9qgxaDakp;Mearp;Keamp9oaqakp;Mearp;Keczp:Rep9qgkpmbezHdiOAlvCXorQLgrp5baipblbpEb:T:j83ibaocwfarp5eaipblbpEe:T:j83ibawaxakpmwDKYqk8AExm35Ps8E8Fgkp5baipblbpEd:T:j83ibaocKfakp5eaipblbpEi:T:j83ibaocafhoavclfgval6mbkkdnalaeSmbaiaeciGgvcitgofcbcaao9R;8kbaiabalcitfgwao;8qbbdnavTmbaiaipblbgraipblzgDpmlvorxmPsCXQL358E8Fgqczp:Segkclp:RepklaaipxbbjZbbjZbbjZbbjZpx;Zl81Z;Zl81Z;Zl81Z;Zl81Zakpxibbbibbbibbbibbbp9qp;6ep;NegkaraDpmbediwDqkzHOAKY8AEgrczp:Reczp:Sep;6ep;MegDaDp;Meakarczp:Sep;6ep;Megxaxp;Meakaqczp:Reczp:Sep;6ep;Megqaqp;Mep;Kep;Kep;Lepxbbbbbbbbbbbbbbbbp:4ep;Jepxb;:FSb;:FSb;:FSb;:FSgkp;Mepxbbn0bbn0bbn0bbn0grp;KepxFFbbFFbbFFbbFFbbgmp9oaxakp;Mearp;Keczp:Rep9qgxaDakp;Mearp;Keamp9oaqakp;Mearp;Keczp:Rep9qgkpmbezHdiOAlvCXorQLgrp5baipblapEb:T:j83ibaiarp5eaipblapEe:T:j83iwaiaxakpmwDKYqk8AExm35Ps8E8Fgkp5baipblapEd:T:j83izaiakp5eaipblapEi:T:j83iKkawaiao;8qbbkk:Pddiue978Jjjjjbc;ab9Rhidnadcd4ae2glc98GgvTmbcbheabhdinadadpbbbgocwp:Recwp:Sep;6eaocep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepkbbadczfhdaeclfgeav6mbkkdnavalSmbaialciGgecdtgdVcbc;abad9R;8kbaiabavcdtfgvad;8qbbdnaeTmbaiaipblbgocwp:Recwp:Sep;6eaocep:SepxbbjFbbjFbbjFbbjFp9opxbbjZbbjZbbjZbbjZp:Uep;Mepklbkavaiad;8qbbkk9teiucbcbydj1jjbgeabcifc98GfgbBdj1jjbdndnabZbcztgd9nmbcuhiabad9RcFFifcz4nbcuSmekaehikaikkkebcjwklz:Dbb",t=new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,3,2,0,0,5,3,1,0,1,12,1,0,10,22,2,12,0,65,0,65,0,65,0,252,10,0,0,11,7,0,65,0,253,15,26,11]),i=new Uint8Array([32,0,65,2,1,106,34,33,3,128,11,4,13,64,6,253,10,7,15,116,127,5,8,12,40,16,19,54,20,9,27,255,113,17,42,67,24,23,146,148,18,14,22,45,70,69,56,114,101,21,25,63,75,136,108,28,118,29,73,115]);if(typeof WebAssembly!="object")return{supported:!1};var s=WebAssembly.validate(t)?a(e):a(n),r,o=WebAssembly.instantiate(s,{}).then(function(p){r=p.instance,r.exports.__wasm_call_ctors()});function a(p){for(var E=new Uint8Array(p.length),v=0;v<p.length;++v){var _=p.charCodeAt(v);E[v]=_>96?_-97:_>64?_-39:_+4}for(var x=0,v=0;v<p.length;++v)E[x++]=E[v]<60?i[E[v]]:(E[v]-60)*64+E[++v];return E.buffer.slice(0,x)}function l(p,E,v,_,x,S,I){var L=p.exports.sbrk,y=_+3&-4,b=L(y*x),R=L(S.length),U=new Uint8Array(p.exports.memory.buffer);U.set(S,R);var N=E(b,_,x,R,S.length);if(N==0&&I&&I(b,y,x),v.set(U.subarray(b,b+_*x)),L(b-L(0)),N!=0)throw new Error("Malformed buffer data: "+N)}var c={NONE:"",OCTAHEDRAL:"meshopt_decodeFilterOct",QUATERNION:"meshopt_decodeFilterQuat",EXPONENTIAL:"meshopt_decodeFilterExp"},u={ATTRIBUTES:"meshopt_decodeVertexBuffer",TRIANGLES:"meshopt_decodeIndexBuffer",INDICES:"meshopt_decodeIndexSequence"},h=[],d=0;function f(p){var E={object:new Worker(p),pending:0,requests:{}};return E.object.onmessage=function(v){var _=v.data;E.pending-=_.count,E.requests[_.id][_.action](_.value),delete E.requests[_.id]},E}function A(p){for(var E="self.ready = WebAssembly.instantiate(new Uint8Array(["+new Uint8Array(s)+"]), {}).then(function(result) { result.instance.exports.__wasm_call_ctors(); return result.instance; });self.onmessage = "+m.name+";"+l.toString()+m.toString(),v=new Blob([E],{type:"text/javascript"}),_=URL.createObjectURL(v),x=h.length;x<p;++x)h[x]=f(_);for(var x=p;x<h.length;++x)h[x].object.postMessage({});h.length=p,URL.revokeObjectURL(_)}function g(p,E,v,_,x){for(var S=h[0],I=1;I<h.length;++I)h[I].pending<S.pending&&(S=h[I]);return new Promise(function(L,y){var b=new Uint8Array(v),R=++d;S.pending+=p,S.requests[R]={resolve:L,reject:y},S.object.postMessage({id:R,count:p,size:E,source:b,mode:_,filter:x},[b.buffer])})}function m(p){var E=p.data;if(!E.id)return self.close();self.ready.then(function(v){try{var _=new Uint8Array(E.count*E.size);l(v,v.exports[E.mode],_,E.count,E.size,E.source,v.exports[E.filter]),self.postMessage({id:E.id,count:E.count,action:"resolve",value:_},[_.buffer])}catch(x){self.postMessage({id:E.id,count:E.count,action:"reject",value:x})}})}return{ready:o,supported:!0,useWorkers:function(p){A(p)},decodeVertexBuffer:function(p,E,v,_,x){l(r,r.exports.meshopt_decodeVertexBuffer,p,E,v,_,r.exports[c[x]])},decodeIndexBuffer:function(p,E,v,_){l(r,r.exports.meshopt_decodeIndexBuffer,p,E,v,_)},decodeIndexSequence:function(p,E,v,_){l(r,r.exports.meshopt_decodeIndexSequence,p,E,v,_)},decodeGltfBuffer:function(p,E,v,_,x,S){l(r,r.exports[u[x]],p,E,v,_,r.exports[c[S]])},decodeGltfBufferAsync:function(p,E,v,_,x){return h.length>0?g(p,E,v,u[_],c[x]):o.then(function(){var S=new Uint8Array(p*E);return l(r,r.exports[u[_]],S,p,E,v,r.exports[c[x]]),S})}}})();const Gw=""+new URL("basis_transcoder-o4Hde_L7.js",import.meta.url).href,zw=""+new URL("basis_transcoder-VXdx5NbI.wasm",import.meta.url).href;/*!
 * @pixiv/three-vrm v3.5.5
 * VRM file loader for three.js.
 *
 * Copyright (c) 2019-2026 pixiv Inc.
 * @pixiv/three-vrm is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */var Ya=(n,e,t)=>new Promise((i,s)=>{var r=l=>{try{a(t.next(l))}catch(c){s(c)}},o=l=>{try{a(t.throw(l))}catch(c){s(c)}},a=l=>l.done?i(l.value):Promise.resolve(l.value).then(r,o);a((t=t.apply(n,e)).next())}),dt=(n,e,t)=>new Promise((i,s)=>{var r=l=>{try{a(t.next(l))}catch(c){s(c)}},o=l=>{try{a(t.throw(l))}catch(c){s(c)}},a=l=>l.done?i(l.value):Promise.resolve(l.value).then(r,o);a((t=t.apply(n,e)).next())}),up=class extends vt{constructor(n){super(),this.weight=0,this.isBinary=!1,this.overrideBlink="none",this.overrideLookAt="none",this.overrideMouth="none",this._binds=[],this.name=`VRMExpression_${n}`,this.expressionName=n,this.type="VRMExpression",this.visible=!1}get binds(){return this._binds}get overrideBlinkAmount(){return this.overrideBlink==="block"?0<this.outputWeight?1:0:this.overrideBlink==="blend"?this.outputWeight:0}get overrideLookAtAmount(){return this.overrideLookAt==="block"?0<this.outputWeight?1:0:this.overrideLookAt==="blend"?this.outputWeight:0}get overrideMouthAmount(){return this.overrideMouth==="block"?0<this.outputWeight?1:0:this.overrideMouth==="blend"?this.outputWeight:0}get outputWeight(){return this.isBinary?this.weight>.5?1:0:this.weight}addBind(n){this._binds.push(n)}deleteBind(n){const e=this._binds.indexOf(n);e>=0&&this._binds.splice(e,1)}applyWeight(n){var e;let t=this.outputWeight;t*=(e=n==null?void 0:n.multiplier)!=null?e:1,this.isBinary&&t<1&&(t=0),this._binds.forEach(i=>i.applyWeight(t))}clearAppliedWeight(){this._binds.forEach(n=>n.clearAppliedWeight())}};function ug(n,e,t){var i,s;const r=n.parser.json,o=(i=r.nodes)==null?void 0:i[e];if(o==null)return console.warn(`extractPrimitivesInternal: Attempt to use nodes[${e}] of glTF but the node doesn't exist`),null;const a=o.mesh;if(a==null)return null;const l=(s=r.meshes)==null?void 0:s[a];if(l==null)return console.warn(`extractPrimitivesInternal: Attempt to use meshes[${a}] of glTF but the mesh doesn't exist`),null;const c=l.primitives.length,u=[];return t.traverse(h=>{u.length<c&&h.isMesh&&u.push(h)}),u}function hp(n,e){return dt(this,null,function*(){const t=yield n.parser.getDependency("node",e);return ug(n,e,t)})}function dp(n){return dt(this,null,function*(){const e=yield n.parser.getDependencies("node"),t=new Map;return e.forEach((i,s)=>{const r=ug(n,s,i);r!=null&&t.set(s,r)}),t})}var lh={Aa:"aa",Ih:"ih",Ou:"ou",Ee:"ee",Oh:"oh",Blink:"blink",Happy:"happy",Angry:"angry",Sad:"sad",Relaxed:"relaxed",LookUp:"lookUp",Surprised:"surprised",LookDown:"lookDown",LookLeft:"lookLeft",LookRight:"lookRight",BlinkLeft:"blinkLeft",BlinkRight:"blinkRight",Neutral:"neutral"};function hg(n){return Math.max(Math.min(n,1),0)}var fp=class dg{constructor(){this.blinkExpressionNames=["blink","blinkLeft","blinkRight"],this.lookAtExpressionNames=["lookLeft","lookRight","lookUp","lookDown"],this.mouthExpressionNames=["aa","ee","ih","oh","ou"],this._expressions=[],this._expressionMap={}}get expressions(){return this._expressions.concat()}get expressionMap(){return Object.assign({},this._expressionMap)}get presetExpressionMap(){const e={},t=new Set(Object.values(lh));return Object.entries(this._expressionMap).forEach(([i,s])=>{t.has(i)&&(e[i]=s)}),e}get customExpressionMap(){const e={},t=new Set(Object.values(lh));return Object.entries(this._expressionMap).forEach(([i,s])=>{t.has(i)||(e[i]=s)}),e}copy(e){return this._expressions.concat().forEach(i=>{this.unregisterExpression(i)}),e._expressions.forEach(i=>{this.registerExpression(i)}),this.blinkExpressionNames=e.blinkExpressionNames.concat(),this.lookAtExpressionNames=e.lookAtExpressionNames.concat(),this.mouthExpressionNames=e.mouthExpressionNames.concat(),this}clone(){return new dg().copy(this)}getExpression(e){var t;return(t=this._expressionMap[e])!=null?t:null}registerExpression(e){this._expressions.push(e),this._expressionMap[e.expressionName]=e}unregisterExpression(e){const t=this._expressions.indexOf(e);t===-1&&console.warn("VRMExpressionManager: The specified expressions is not registered"),this._expressions.splice(t,1),delete this._expressionMap[e.expressionName]}getValue(e){var t;const i=this.getExpression(e);return(t=i==null?void 0:i.weight)!=null?t:null}setValue(e,t){const i=this.getExpression(e);i&&(i.weight=hg(t))}resetValues(){this._expressions.forEach(e=>{e.weight=0})}getExpressionTrackName(e){const t=this.getExpression(e);return t?`${t.name}.weight`:null}update(){const e=this._calculateWeightMultipliers();this._expressions.forEach(t=>{t.clearAppliedWeight()}),this._expressions.forEach(t=>{let i=1;const s=t.expressionName;this.blinkExpressionNames.indexOf(s)!==-1&&(i*=e.blink),this.lookAtExpressionNames.indexOf(s)!==-1&&(i*=e.lookAt),this.mouthExpressionNames.indexOf(s)!==-1&&(i*=e.mouth),t.applyWeight({multiplier:i})})}_calculateWeightMultipliers(){let e=1,t=1,i=1;return this._expressions.forEach(s=>{e-=s.overrideBlinkAmount,t-=s.overrideLookAtAmount,i-=s.overrideMouthAmount}),e=Math.max(0,e),t=Math.max(0,t),i=Math.max(0,i),{blink:e,lookAt:t,mouth:i}}},fo={Color:"color",EmissionColor:"emissionColor",ShadeColor:"shadeColor",RimColor:"rimColor",OutlineColor:"outlineColor"},Vw={_Color:fo.Color,_EmissionColor:fo.EmissionColor,_ShadeColor:fo.ShadeColor,_RimColor:fo.RimColor,_OutlineColor:fo.OutlineColor},Ww=new ye,fg=class pg{constructor({material:e,type:t,targetValue:i,targetAlpha:s}){this.material=e,this.type=t,this.targetValue=i,this.targetAlpha=s??1;const r=this._initColorBindState(),o=this._initAlphaBindState();this._state={color:r,alpha:o}}applyWeight(e){const{color:t,alpha:i}=this._state;if(t!=null){const{propertyName:s,deltaValue:r}=t,o=this.material[s];o!=null&&o.add(Ww.copy(r).multiplyScalar(e))}if(i!=null){const{propertyName:s,deltaValue:r}=i;this.material[s]!=null&&(this.material[s]+=r*e)}}clearAppliedWeight(){const{color:e,alpha:t}=this._state;if(e!=null){const{propertyName:i,initialValue:s}=e,r=this.material[i];r!=null&&r.copy(s)}if(t!=null){const{propertyName:i,initialValue:s}=t;this.material[i]!=null&&(this.material[i]=s)}}_initColorBindState(){var e,t,i;const{material:s,type:r,targetValue:o}=this,a=this._getPropertyNameMap(),l=(t=(e=a==null?void 0:a[r])==null?void 0:e[0])!=null?t:null;if(l==null)return console.warn(`Tried to add a material color bind to the material ${(i=s.name)!=null?i:"(no name)"}, the type ${r} but the material or the type is not supported.`),null;const u=s[l].clone(),h=new ye(o.r-u.r,o.g-u.g,o.b-u.b);return{propertyName:l,initialValue:u,deltaValue:h}}_initAlphaBindState(){var e,t,i;const{material:s,type:r,targetAlpha:o}=this,a=this._getPropertyNameMap(),l=(t=(e=a==null?void 0:a[r])==null?void 0:e[1])!=null?t:null;if(l==null&&o!==1)return console.warn(`Tried to add a material alpha bind to the material ${(i=s.name)!=null?i:"(no name)"}, the type ${r} but the material or the type does not support alpha.`),null;if(l==null)return null;const c=s[l],u=o-c;return{propertyName:l,initialValue:c,deltaValue:u}}_getPropertyNameMap(){var e,t;return(t=(e=Object.entries(pg._propertyNameMapMap).find(([i])=>this.material[i]===!0))==null?void 0:e[1])!=null?t:null}};fg._propertyNameMapMap={isMeshStandardMaterial:{color:["color","opacity"],emissionColor:["emissive",null]},isMeshBasicMaterial:{color:["color","opacity"]},isMToonMaterial:{color:["color","opacity"],emissionColor:["emissive",null],outlineColor:["outlineColorFactor",null],matcapColor:["matcapFactor",null],rimColor:["parametricRimColorFactor",null],shadeColor:["shadeColorFactor",null]}};var pp=fg,Dl=class{constructor({primitives:n,index:e,weight:t}){this.primitives=n,this.index=e,this.weight=t}applyWeight(n){this.primitives.forEach(e=>{var t;((t=e.morphTargetInfluences)==null?void 0:t[this.index])!=null&&(e.morphTargetInfluences[this.index]+=this.weight*n)})}clearAppliedWeight(){this.primitives.forEach(n=>{var e;((e=n.morphTargetInfluences)==null?void 0:e[this.index])!=null&&(n.morphTargetInfluences[this.index]=0)})}},Ap=new ce,Ag=class mg{constructor({material:e,scale:t,offset:i}){var s,r;this.material=e,this.scale=t,this.offset=i;const o=(s=Object.entries(mg._propertyNamesMap).find(([a])=>e[a]===!0))==null?void 0:s[1];o==null?(console.warn(`Tried to add a texture transform bind to the material ${(r=e.name)!=null?r:"(no name)"} but the material is not supported.`),this._properties=[]):(this._properties=[],o.forEach(a=>{var l;const c=(l=e[a])==null?void 0:l.clone();if(!c)return null;e[a]=c;const u=c.offset.clone(),h=c.repeat.clone(),d=i.clone().sub(u),f=t.clone().sub(h);this._properties.push({name:a,initialOffset:u,deltaOffset:d,initialScale:h,deltaScale:f})}))}applyWeight(e){this._properties.forEach(t=>{const i=this.material[t.name];i!==void 0&&(i.offset.add(Ap.copy(t.deltaOffset).multiplyScalar(e)),i.repeat.add(Ap.copy(t.deltaScale).multiplyScalar(e)))})}clearAppliedWeight(){this._properties.forEach(e=>{const t=this.material[e.name];t!==void 0&&(t.offset.copy(e.initialOffset),t.repeat.copy(e.initialScale))})}};Ag._propertyNamesMap={isMeshStandardMaterial:["map","emissiveMap","bumpMap","normalMap","displacementMap","roughnessMap","metalnessMap","alphaMap"],isMeshBasicMaterial:["map","specularMap","alphaMap"],isMToonMaterial:["map","normalMap","emissiveMap","shadeMultiplyTexture","rimMultiplyTexture","outlineWidthMultiplyTexture","uvAnimationMaskTexture"]};var mp=Ag,qw=new Set(["1.0","1.0-beta"]),gg=class _g{get name(){return"VRMExpressionLoaderPlugin"}constructor(e){this.parser=e}afterRoot(e){return dt(this,null,function*(){e.userData.vrmExpressionManager=yield this._import(e)})}_import(e){return dt(this,null,function*(){const t=yield this._v1Import(e);if(t)return t;const i=yield this._v0Import(e);return i||null})}_v1Import(e){return dt(this,null,function*(){var t,i;const s=this.parser.json;if(!(((t=s.extensionsUsed)==null?void 0:t.indexOf("VRMC_vrm"))!==-1))return null;const o=(i=s.extensions)==null?void 0:i.VRMC_vrm;if(!o)return null;const a=o.specVersion;if(!qw.has(a))return console.warn(`VRMExpressionLoaderPlugin: Unknown VRMC_vrm specVersion "${a}"`),null;const l=o.expressions;if(!l)return null;const c=new Set(Object.values(lh)),u=new Map;l.preset!=null&&Object.entries(l.preset).forEach(([d,f])=>{if(f!=null){if(!c.has(d)){console.warn(`VRMExpressionLoaderPlugin: Unknown preset name "${d}" detected. Ignoring the expression`);return}u.set(d,f)}}),l.custom!=null&&Object.entries(l.custom).forEach(([d,f])=>{if(c.has(d)){console.warn(`VRMExpressionLoaderPlugin: Custom expression cannot have preset name "${d}". Ignoring the expression`);return}u.set(d,f)});const h=new fp;return yield Promise.all(Array.from(u.entries()).map(d=>dt(this,[d],function*([f,A]){var g,m,p,E,v,_,x;const S=new up(f);if(e.scene.add(S),S.isBinary=(g=A.isBinary)!=null?g:!1,S.overrideBlink=(m=A.overrideBlink)!=null?m:"none",S.overrideLookAt=(p=A.overrideLookAt)!=null?p:"none",S.overrideMouth=(E=A.overrideMouth)!=null?E:"none",(v=A.morphTargetBinds)==null||v.forEach(I=>dt(this,null,function*(){var L;if(I.node===void 0||I.index===void 0)return;const y=yield hp(e,I.node),b=I.index;if(!y.every(R=>Array.isArray(R.morphTargetInfluences)&&b<R.morphTargetInfluences.length)){console.warn(`VRMExpressionLoaderPlugin: ${A.name} attempts to index morph #${b} but not found.`);return}S.addBind(new Dl({primitives:y,index:b,weight:(L=I.weight)!=null?L:1}))})),A.materialColorBinds||A.textureTransformBinds){const I=[];e.scene.traverse(L=>{const y=L.material;y&&(Array.isArray(y)?I.push(...y):I.push(y))}),(_=A.materialColorBinds)==null||_.forEach(L=>dt(this,null,function*(){I.filter(b=>{var R;const U=(R=this.parser.associations.get(b))==null?void 0:R.materials;return L.material===U}).forEach(b=>{S.addBind(new pp({material:b,type:L.type,targetValue:new ye().fromArray(L.targetValue),targetAlpha:L.targetValue[3]}))})})),(x=A.textureTransformBinds)==null||x.forEach(L=>dt(this,null,function*(){I.filter(b=>{var R;const U=(R=this.parser.associations.get(b))==null?void 0:R.materials;return L.material===U}).forEach(b=>{var R,U;S.addBind(new mp({material:b,offset:new ce().fromArray((R=L.offset)!=null?R:[0,0]),scale:new ce().fromArray((U=L.scale)!=null?U:[1,1])}))})}))}h.registerExpression(S)}))),h})}_v0Import(e){return dt(this,null,function*(){var t;const i=this.parser.json,s=(t=i.extensions)==null?void 0:t.VRM;if(!s)return null;const r=s.blendShapeMaster;if(!r)return null;const o=new fp,a=r.blendShapeGroups;if(!a)return o;const l=new Set;return yield Promise.all(a.map(c=>dt(this,null,function*(){var u;const h=c.presetName,d=h!=null&&_g.v0v1PresetNameMap[h]||null,f=d??c.name;if(f==null){console.warn("VRMExpressionLoaderPlugin: One of custom expressions has no name. Ignoring the expression");return}if(l.has(f)){console.warn(`VRMExpressionLoaderPlugin: An expression preset ${h} has duplicated entries. Ignoring the expression`);return}l.add(f);const A=new up(f);e.scene.add(A),A.isBinary=(u=c.isBinary)!=null?u:!1,c.binds&&c.binds.forEach(m=>dt(this,null,function*(){var p;if(m.mesh===void 0||m.index===void 0)return;const E=[];if((p=i.nodes)==null||p.forEach((_,x)=>{_.mesh===m.mesh&&E.push(x)}),E.length===0){console.warn(`VRMExpressionLoaderPlugin: ${c.name} attempts to bind a morph target to the mesh #${m.mesh} but the mesh is not found or not used in the scene. Ignoring the bind.`);return}const v=m.index;yield Promise.all(E.map(_=>dt(this,null,function*(){var x;const S=yield hp(e,_);if(!S.every(I=>Array.isArray(I.morphTargetInfluences)&&v<I.morphTargetInfluences.length)){console.warn(`VRMExpressionLoaderPlugin: ${c.name} attempts to index ${v}th morph but not found.`);return}A.addBind(new Dl({primitives:S,index:v,weight:.01*((x=m.weight)!=null?x:100)}))})))}));const g=c.materialValues;g&&g.length!==0&&g.forEach(m=>{if(m.materialName===void 0||m.propertyName===void 0||m.targetValue===void 0)return;const p=[];e.scene.traverse(v=>{if(v.material){const _=v.material;Array.isArray(_)?p.push(..._.filter(x=>(x.name===m.materialName||x.name===m.materialName+" (Outline)")&&p.indexOf(x)===-1)):_.name===m.materialName&&p.indexOf(_)===-1&&p.push(_)}});const E=m.propertyName;p.forEach(v=>{if(E==="_MainTex_ST"){const x=new ce(m.targetValue[0],m.targetValue[1]),S=new ce(m.targetValue[2],m.targetValue[3]);S.y=1-S.y-x.y,A.addBind(new mp({material:v,scale:x,offset:S}));return}const _=Vw[E];if(_){A.addBind(new pp({material:v,type:_,targetValue:new ye().fromArray(m.targetValue),targetAlpha:m.targetValue[3]}));return}console.warn(E+" is not supported")})}),o.registerExpression(A)}))),o})}};gg.v0v1PresetNameMap={a:"aa",e:"ee",i:"ih",o:"oh",u:"ou",blink:"blink",joy:"happy",angry:"angry",sorrow:"sad",fun:"relaxed",lookup:"lookUp",lookdown:"lookDown",lookleft:"lookLeft",lookright:"lookRight",blink_l:"blinkLeft",blink_r:"blinkRight",neutral:"neutral"};var Xw=gg,Zh=class hr{constructor(e,t){this._firstPersonOnlyLayer=hr.DEFAULT_FIRSTPERSON_ONLY_LAYER,this._thirdPersonOnlyLayer=hr.DEFAULT_THIRDPERSON_ONLY_LAYER,this._initializedLayers=!1,this.humanoid=e,this.meshAnnotations=t}copy(e){if(this.humanoid!==e.humanoid)throw new Error("VRMFirstPerson: humanoid must be same in order to copy");return this.meshAnnotations=e.meshAnnotations.map(t=>({meshes:t.meshes.concat(),type:t.type})),this}clone(){return new hr(this.humanoid,this.meshAnnotations).copy(this)}get firstPersonOnlyLayer(){return this._firstPersonOnlyLayer}get thirdPersonOnlyLayer(){return this._thirdPersonOnlyLayer}setup({firstPersonOnlyLayer:e=hr.DEFAULT_FIRSTPERSON_ONLY_LAYER,thirdPersonOnlyLayer:t=hr.DEFAULT_THIRDPERSON_ONLY_LAYER}={}){this._initializedLayers||(this._firstPersonOnlyLayer=e,this._thirdPersonOnlyLayer=t,this.meshAnnotations.forEach(i=>{i.meshes.forEach(s=>{i.type==="firstPersonOnly"?(s.layers.set(this._firstPersonOnlyLayer),s.traverse(r=>r.layers.set(this._firstPersonOnlyLayer))):i.type==="thirdPersonOnly"?(s.layers.set(this._thirdPersonOnlyLayer),s.traverse(r=>r.layers.set(this._thirdPersonOnlyLayer))):i.type==="auto"&&this._createHeadlessModel(s)})}),this._initializedLayers=!0)}_excludeTriangles(e,t,i,s){let r=0;if(t!=null&&t.length>0)for(let o=0;o<e.length;o+=3){const a=e[o],l=e[o+1],c=e[o+2],u=t[a],h=i[a];if(u[0]>0&&s.includes(h[0])||u[1]>0&&s.includes(h[1])||u[2]>0&&s.includes(h[2])||u[3]>0&&s.includes(h[3]))continue;const d=t[l],f=i[l];if(d[0]>0&&s.includes(f[0])||d[1]>0&&s.includes(f[1])||d[2]>0&&s.includes(f[2])||d[3]>0&&s.includes(f[3]))continue;const A=t[c],g=i[c];A[0]>0&&s.includes(g[0])||A[1]>0&&s.includes(g[1])||A[2]>0&&s.includes(g[2])||A[3]>0&&s.includes(g[3])||(e[r++]=a,e[r++]=l,e[r++]=c)}return r}_createErasedMesh(e,t){const i=new LA(e.geometry.clone(),e.material);i.name=`${e.name}(erase)`,i.frustumCulled=e.frustumCulled,i.layers.set(this._firstPersonOnlyLayer);const s=i.geometry,r=s.getAttribute("skinIndex"),o=r instanceof lf?[]:r.array,a=[];for(let g=0;g<o.length;g+=4)a.push([o[g],o[g+1],o[g+2],o[g+3]]);const l=s.getAttribute("skinWeight"),c=l instanceof lf?[]:l.array,u=[];for(let g=0;g<c.length;g+=4)u.push([c[g],c[g+1],c[g+2],c[g+3]]);const h=s.getIndex();if(!h)throw new Error("The geometry doesn't have an index buffer");const d=Array.from(h.array),f=this._excludeTriangles(d,u,a,t),A=[];for(let g=0;g<f;g++)A[g]=d[g];return s.setIndex(A),e.onBeforeRender&&(i.onBeforeRender=e.onBeforeRender),i.bind(new Hr(e.skeleton.bones,e.skeleton.boneInverses),new Qe),i}_createHeadlessModelForSkinnedMesh(e,t){const i=[];if(t.skeleton.bones.forEach((r,o)=>{this._isEraseTarget(r)&&i.push(o)}),!i.length){t.layers.enable(this._thirdPersonOnlyLayer),t.layers.enable(this._firstPersonOnlyLayer);return}t.layers.set(this._thirdPersonOnlyLayer);const s=this._createErasedMesh(t,i);e.add(s)}_createHeadlessModel(e){if(e.type==="Group")if(e.layers.set(this._thirdPersonOnlyLayer),this._isEraseTarget(e))e.traverse(t=>t.layers.set(this._thirdPersonOnlyLayer));else{const t=new Ct;t.name=`_headless_${e.name}`,t.layers.set(this._firstPersonOnlyLayer),e.parent.add(t),e.children.filter(i=>i.type==="SkinnedMesh").forEach(i=>{const s=i;this._createHeadlessModelForSkinnedMesh(t,s)})}else if(e.type==="SkinnedMesh"){const t=e;this._createHeadlessModelForSkinnedMesh(e.parent,t)}else this._isEraseTarget(e)&&(e.layers.set(this._thirdPersonOnlyLayer),e.traverse(t=>t.layers.set(this._thirdPersonOnlyLayer)))}_isEraseTarget(e){return e===this.humanoid.getRawBoneNode("head")?!0:e.parent?this._isEraseTarget(e.parent):!1}};Zh.DEFAULT_FIRSTPERSON_ONLY_LAYER=9;Zh.DEFAULT_THIRDPERSON_ONLY_LAYER=10;var gp=Zh,Yw=new Set(["1.0","1.0-beta"]),jw=class{get name(){return"VRMFirstPersonLoaderPlugin"}constructor(n){this.parser=n}afterRoot(n){return dt(this,null,function*(){const e=n.userData.vrmHumanoid;if(e!==null){if(e===void 0)throw new Error("VRMFirstPersonLoaderPlugin: vrmHumanoid is undefined. VRMHumanoidLoaderPlugin have to be used first");n.userData.vrmFirstPerson=yield this._import(n,e)}})}_import(n,e){return dt(this,null,function*(){if(e==null)return null;const t=yield this._v1Import(n,e);if(t)return t;const i=yield this._v0Import(n,e);return i||null})}_v1Import(n,e){return dt(this,null,function*(){var t,i;const s=this.parser.json;if(!(((t=s.extensionsUsed)==null?void 0:t.indexOf("VRMC_vrm"))!==-1))return null;const o=(i=s.extensions)==null?void 0:i.VRMC_vrm;if(!o)return null;const a=o.specVersion;if(!Yw.has(a))return console.warn(`VRMFirstPersonLoaderPlugin: Unknown VRMC_vrm specVersion "${a}"`),null;const l=o.firstPerson,c=[],u=yield dp(n);return Array.from(u.entries()).forEach(([h,d])=>{var f,A;const g=(f=l==null?void 0:l.meshAnnotations)==null?void 0:f.find(m=>m.node===h);c.push({meshes:d,type:(A=g==null?void 0:g.type)!=null?A:"auto"})}),new gp(e,c)})}_v0Import(n,e){return dt(this,null,function*(){var t;const i=this.parser.json,s=(t=i.extensions)==null?void 0:t.VRM;if(!s)return null;const r=s.firstPerson;if(!r)return null;const o=[],a=yield dp(n);return Array.from(a.entries()).forEach(([l,c])=>{const u=i.nodes[l],h=r.meshAnnotations?r.meshAnnotations.find(d=>d.mesh===u.mesh):void 0;o.push({meshes:c,type:this._convertV0FlagToV1Type(h==null?void 0:h.firstPersonFlag)})}),new gp(e,o)})}_convertV0FlagToV1Type(n){return n==="FirstPersonOnly"?"firstPersonOnly":n==="ThirdPersonOnly"?"thirdPersonOnly":n==="Both"?"both":"auto"}},_p=new w,vp=new w,Jw=new je,xp=class extends Ct{constructor(n){super(),this.vrmHumanoid=n,this._boneAxesMap=new Map,Object.values(n.humanBones).forEach(e=>{const t=new Vv(1);t.matrixAutoUpdate=!1,t.material.depthTest=!1,t.material.depthWrite=!1,this.add(t),this._boneAxesMap.set(e,t)})}dispose(){Array.from(this._boneAxesMap.values()).forEach(n=>{n.geometry.dispose(),n.material.dispose()})}updateMatrixWorld(n){Array.from(this._boneAxesMap.entries()).forEach(([e,t])=>{e.node.updateWorldMatrix(!0,!1),e.node.matrixWorld.decompose(_p,Jw,vp);const i=_p.set(.1,.1,.1).divide(vp);t.matrix.copy(e.node.matrixWorld).scale(i)}),super.updateMatrixWorld(n)}},au=["hips","spine","chest","upperChest","neck","head","leftEye","rightEye","jaw","leftUpperLeg","leftLowerLeg","leftFoot","leftToes","rightUpperLeg","rightLowerLeg","rightFoot","rightToes","leftShoulder","leftUpperArm","leftLowerArm","leftHand","rightShoulder","rightUpperArm","rightLowerArm","rightHand","leftThumbMetacarpal","leftThumbProximal","leftThumbDistal","leftIndexProximal","leftIndexIntermediate","leftIndexDistal","leftMiddleProximal","leftMiddleIntermediate","leftMiddleDistal","leftRingProximal","leftRingIntermediate","leftRingDistal","leftLittleProximal","leftLittleIntermediate","leftLittleDistal","rightThumbMetacarpal","rightThumbProximal","rightThumbDistal","rightIndexProximal","rightIndexIntermediate","rightIndexDistal","rightMiddleProximal","rightMiddleIntermediate","rightMiddleDistal","rightRingProximal","rightRingIntermediate","rightRingDistal","rightLittleProximal","rightLittleIntermediate","rightLittleDistal"],Kw={hips:null,spine:"hips",chest:"spine",upperChest:"chest",neck:"upperChest",head:"neck",leftEye:"head",rightEye:"head",jaw:"head",leftUpperLeg:"hips",leftLowerLeg:"leftUpperLeg",leftFoot:"leftLowerLeg",leftToes:"leftFoot",rightUpperLeg:"hips",rightLowerLeg:"rightUpperLeg",rightFoot:"rightLowerLeg",rightToes:"rightFoot",leftShoulder:"upperChest",leftUpperArm:"leftShoulder",leftLowerArm:"leftUpperArm",leftHand:"leftLowerArm",rightShoulder:"upperChest",rightUpperArm:"rightShoulder",rightLowerArm:"rightUpperArm",rightHand:"rightLowerArm",leftThumbMetacarpal:"leftHand",leftThumbProximal:"leftThumbMetacarpal",leftThumbDistal:"leftThumbProximal",leftIndexProximal:"leftHand",leftIndexIntermediate:"leftIndexProximal",leftIndexDistal:"leftIndexIntermediate",leftMiddleProximal:"leftHand",leftMiddleIntermediate:"leftMiddleProximal",leftMiddleDistal:"leftMiddleIntermediate",leftRingProximal:"leftHand",leftRingIntermediate:"leftRingProximal",leftRingDistal:"leftRingIntermediate",leftLittleProximal:"leftHand",leftLittleIntermediate:"leftLittleProximal",leftLittleDistal:"leftLittleIntermediate",rightThumbMetacarpal:"rightHand",rightThumbProximal:"rightThumbMetacarpal",rightThumbDistal:"rightThumbProximal",rightIndexProximal:"rightHand",rightIndexIntermediate:"rightIndexProximal",rightIndexDistal:"rightIndexIntermediate",rightMiddleProximal:"rightHand",rightMiddleIntermediate:"rightMiddleProximal",rightMiddleDistal:"rightMiddleIntermediate",rightRingProximal:"rightHand",rightRingIntermediate:"rightRingProximal",rightRingDistal:"rightRingIntermediate",rightLittleProximal:"rightHand",rightLittleIntermediate:"rightLittleProximal",rightLittleDistal:"rightLittleIntermediate"};function vg(n){return n.invert?n.invert():n.inverse(),n}var es=new w,ts=new je,ch=class{constructor(n){this.humanBones=n,this.restPose=this.getAbsolutePose()}getAbsolutePose(){const n={};return Object.keys(this.humanBones).forEach(e=>{const t=e,i=this.getBoneNode(t);i&&(es.copy(i.position),ts.copy(i.quaternion),n[t]={position:es.toArray(),rotation:ts.toArray()})}),n}getPose(){const n={};return Object.keys(this.humanBones).forEach(e=>{const t=e,i=this.getBoneNode(t);if(!i)return;es.set(0,0,0),ts.identity();const s=this.restPose[t];s!=null&&s.position&&es.fromArray(s.position).negate(),s!=null&&s.rotation&&vg(ts.fromArray(s.rotation)),es.add(i.position),ts.premultiply(i.quaternion),n[t]={position:es.toArray(),rotation:ts.toArray()}}),n}setPose(n){Object.entries(n).forEach(([e,t])=>{const i=e,s=this.getBoneNode(i);if(!s)return;const r=this.restPose[i];r&&(t!=null&&t.position&&(s.position.fromArray(t.position),r.position&&s.position.add(es.fromArray(r.position))),t!=null&&t.rotation&&(s.quaternion.fromArray(t.rotation),r.rotation&&s.quaternion.multiply(ts.fromArray(r.rotation))))})}resetPose(){Object.entries(this.restPose).forEach(([n,e])=>{const t=this.getBoneNode(n);t&&(e!=null&&e.position&&t.position.fromArray(e.position),e!=null&&e.rotation&&t.quaternion.fromArray(e.rotation))})}getBone(n){var e;return(e=this.humanBones[n])!=null?e:void 0}getBoneNode(n){var e,t;return(t=(e=this.humanBones[n])==null?void 0:e.node)!=null?t:null}},lu=new w,Zw=new je,$w=new w,Ep=class xg extends ch{static _setupTransforms(e){const t=new vt;t.name="VRMHumanoidRig";const i={},s={},r={};au.forEach(a=>{var l;const c=e.getBoneNode(a);if(c){const u=new w,h=new je;c.updateWorldMatrix(!0,!1),c.matrixWorld.decompose(u,h,lu),i[a]=u,s[a]=c.quaternion.clone();const d=new je;(l=c.parent)==null||l.matrixWorld.decompose(lu,d,lu),r[a]=d}});const o={};return au.forEach(a=>{var l;const c=e.getBoneNode(a);if(c){const u=i[a];let h=a,d;for(;d==null&&(h=Kw[h],h!=null);)d=i[h];const f=new vt;f.name="Normalized_"+c.name,(h?(l=o[h])==null?void 0:l.node:t).add(f),f.position.copy(u),d&&f.position.sub(d),o[a]={node:f}}}),{rigBones:o,root:t,parentWorldRotations:r,boneRotations:s}}constructor(e){const{rigBones:t,root:i,parentWorldRotations:s,boneRotations:r}=xg._setupTransforms(e);super(t),this.original=e,this.root=i,this._parentWorldRotations=s,this._boneRotations=r}update(){au.forEach(e=>{const t=this.original.getBoneNode(e);if(t!=null){const i=this.getBoneNode(e),s=this._parentWorldRotations[e],r=Zw.copy(s).invert(),o=this._boneRotations[e];if(t.quaternion.copy(i.quaternion).multiply(s).premultiply(r).multiply(o),e==="hips"){const a=i.getWorldPosition($w);t.parent.updateWorldMatrix(!0,!1);const l=t.parent.matrixWorld,c=a.applyMatrix4(l.invert());t.position.copy(c)}}})}},bp=class Eg{get restPose(){return console.warn("VRMHumanoid: restPose is deprecated. Use either rawRestPose or normalizedRestPose instead."),this.rawRestPose}get rawRestPose(){return this._rawHumanBones.restPose}get normalizedRestPose(){return this._normalizedHumanBones.restPose}get humanBones(){return this._rawHumanBones.humanBones}get rawHumanBones(){return this._rawHumanBones.humanBones}get normalizedHumanBones(){return this._normalizedHumanBones.humanBones}get normalizedHumanBonesRoot(){return this._normalizedHumanBones.root}constructor(e,t){var i;this.autoUpdateHumanBones=(i=t==null?void 0:t.autoUpdateHumanBones)!=null?i:!0,this._rawHumanBones=new ch(e),this._normalizedHumanBones=new Ep(this._rawHumanBones)}copy(e){return this.autoUpdateHumanBones=e.autoUpdateHumanBones,this._rawHumanBones=new ch(e.humanBones),this._normalizedHumanBones=new Ep(this._rawHumanBones),this}clone(){return new Eg(this.humanBones,{autoUpdateHumanBones:this.autoUpdateHumanBones}).copy(this)}getAbsolutePose(){return console.warn("VRMHumanoid: getAbsolutePose() is deprecated. Use either getRawAbsolutePose() or getNormalizedAbsolutePose() instead."),this.getRawAbsolutePose()}getRawAbsolutePose(){return this._rawHumanBones.getAbsolutePose()}getNormalizedAbsolutePose(){return this._normalizedHumanBones.getAbsolutePose()}getPose(){return console.warn("VRMHumanoid: getPose() is deprecated. Use either getRawPose() or getNormalizedPose() instead."),this.getRawPose()}getRawPose(){return this._rawHumanBones.getPose()}getNormalizedPose(){return this._normalizedHumanBones.getPose()}setPose(e){return console.warn("VRMHumanoid: setPose() is deprecated. Use either setRawPose() or setNormalizedPose() instead."),this.setRawPose(e)}setRawPose(e){return this._rawHumanBones.setPose(e)}setNormalizedPose(e){return this._normalizedHumanBones.setPose(e)}resetPose(){return console.warn("VRMHumanoid: resetPose() is deprecated. Use either resetRawPose() or resetNormalizedPose() instead."),this.resetRawPose()}resetRawPose(){return this._rawHumanBones.resetPose()}resetNormalizedPose(){return this._normalizedHumanBones.resetPose()}getBone(e){return console.warn("VRMHumanoid: getBone() is deprecated. Use either getRawBone() or getNormalizedBone() instead."),this.getRawBone(e)}getRawBone(e){return this._rawHumanBones.getBone(e)}getNormalizedBone(e){return this._normalizedHumanBones.getBone(e)}getBoneNode(e){return console.warn("VRMHumanoid: getBoneNode() is deprecated. Use either getRawBoneNode() or getNormalizedBoneNode() instead."),this.getRawBoneNode(e)}getRawBoneNode(e){return this._rawHumanBones.getBoneNode(e)}getNormalizedBoneNode(e){return this._normalizedHumanBones.getBoneNode(e)}update(){this.autoUpdateHumanBones&&this._normalizedHumanBones.update()}},eC={Hips:"hips",Spine:"spine",Head:"head",LeftUpperLeg:"leftUpperLeg",LeftLowerLeg:"leftLowerLeg",LeftFoot:"leftFoot",RightUpperLeg:"rightUpperLeg",RightLowerLeg:"rightLowerLeg",RightFoot:"rightFoot",LeftUpperArm:"leftUpperArm",LeftLowerArm:"leftLowerArm",LeftHand:"leftHand",RightUpperArm:"rightUpperArm",RightLowerArm:"rightLowerArm",RightHand:"rightHand"},tC=new Set(["1.0","1.0-beta"]),yp={leftThumbProximal:"leftThumbMetacarpal",leftThumbIntermediate:"leftThumbProximal",rightThumbProximal:"rightThumbMetacarpal",rightThumbIntermediate:"rightThumbProximal"},nC=class{get name(){return"VRMHumanoidLoaderPlugin"}constructor(n,e){this.parser=n,this.helperRoot=e==null?void 0:e.helperRoot,this.autoUpdateHumanBones=e==null?void 0:e.autoUpdateHumanBones}afterRoot(n){return dt(this,null,function*(){n.userData.vrmHumanoid=yield this._import(n)})}_import(n){return dt(this,null,function*(){const e=yield this._v1Import(n);if(e)return e;const t=yield this._v0Import(n);return t||null})}_v1Import(n){return dt(this,null,function*(){var e,t;const i=this.parser.json;if(!(((e=i.extensionsUsed)==null?void 0:e.indexOf("VRMC_vrm"))!==-1))return null;const r=(t=i.extensions)==null?void 0:t.VRMC_vrm;if(!r)return null;const o=r.specVersion;if(!tC.has(o))return console.warn(`VRMHumanoidLoaderPlugin: Unknown VRMC_vrm specVersion "${o}"`),null;const a=r.humanoid;if(!a)return null;const l=a.humanBones.leftThumbIntermediate!=null||a.humanBones.rightThumbIntermediate!=null,c={};a.humanBones!=null&&(yield Promise.all(Object.entries(a.humanBones).map(h=>dt(this,[h],function*([d,f]){let A=d;const g=f.node;if(l){const p=yp[A];p!=null&&(A=p)}const m=yield this.parser.getDependency("node",g);if(m==null){console.warn(`A glTF node bound to the humanoid bone ${A} (index = ${g}) does not exist`);return}c[A]={node:m}}))));const u=new bp(this._ensureRequiredBonesExist(c),{autoUpdateHumanBones:this.autoUpdateHumanBones});if(n.scene.add(u.normalizedHumanBonesRoot),this.helperRoot){const h=new xp(u);this.helperRoot.add(h),h.renderOrder=this.helperRoot.renderOrder}return u})}_v0Import(n){return dt(this,null,function*(){var e;const i=(e=this.parser.json.extensions)==null?void 0:e.VRM;if(!i)return null;const s=i.humanoid;if(!s)return null;const r={};s.humanBones!=null&&(yield Promise.all(s.humanBones.map(a=>dt(this,null,function*(){const l=a.bone,c=a.node;if(l==null||c==null)return;if(c<0){console.warn(`A glTF node index for the humanoid bone ${l} is negative (${c}), ignoring this bone.`);return}const u=yield this.parser.getDependency("node",c);if(u==null){console.warn(`A glTF node bound to the humanoid bone ${l} (index = ${c}) does not exist`);return}const h=yp[l],d=h??l;if(r[d]!=null){console.warn(`Multiple bone entries for ${d} detected (index = ${c}), ignoring duplicated entries.`);return}r[d]={node:u}}))));const o=new bp(this._ensureRequiredBonesExist(r),{autoUpdateHumanBones:this.autoUpdateHumanBones});if(n.scene.add(o.normalizedHumanBonesRoot),this.helperRoot){const a=new xp(o);this.helperRoot.add(a),a.renderOrder=this.helperRoot.renderOrder}return o})}_ensureRequiredBonesExist(n){const e=Object.values(eC).filter(t=>n[t]==null);if(e.length>0)throw new Error(`VRMHumanoidLoaderPlugin: These humanoid bones are required but not exist: ${e.join(", ")}`);return n}},Mp=class extends mt{constructor(){super(),this._currentTheta=0,this._currentRadius=0,this.theta=0,this.radius=0,this._currentTheta=0,this._currentRadius=0,this._attrPos=new it(new Float32Array(195),3),this.setAttribute("position",this._attrPos),this._attrIndex=new it(new Uint16Array(189),1),this.setIndex(this._attrIndex),this._buildIndex(),this.update()}update(){let n=!1;this._currentTheta!==this.theta&&(this._currentTheta=this.theta,n=!0),this._currentRadius!==this.radius&&(this._currentRadius=this.radius,n=!0),n&&this._buildPosition()}_buildPosition(){this._attrPos.setXYZ(0,0,0,0);for(let n=0;n<64;n++){const e=n/63*this._currentTheta;this._attrPos.setXYZ(n+1,this._currentRadius*Math.sin(e),0,this._currentRadius*Math.cos(e))}this._attrPos.needsUpdate=!0}_buildIndex(){for(let n=0;n<63;n++)this._attrIndex.setXYZ(n*3,0,n+1,n+2);this._attrIndex.needsUpdate=!0}},iC=class extends mt{constructor(){super(),this.radius=0,this._currentRadius=0,this.tail=new w,this._currentTail=new w,this._attrPos=new it(new Float32Array(294),3),this.setAttribute("position",this._attrPos),this._attrIndex=new it(new Uint16Array(194),1),this.setIndex(this._attrIndex),this._buildIndex(),this.update()}update(){let n=!1;this._currentRadius!==this.radius&&(this._currentRadius=this.radius,n=!0),this._currentTail.equals(this.tail)||(this._currentTail.copy(this.tail),n=!0),n&&this._buildPosition()}_buildPosition(){for(let n=0;n<32;n++){const e=n/16*Math.PI;this._attrPos.setXYZ(n,Math.cos(e),Math.sin(e),0),this._attrPos.setXYZ(32+n,0,Math.cos(e),Math.sin(e)),this._attrPos.setXYZ(64+n,Math.sin(e),0,Math.cos(e))}this.scale(this._currentRadius,this._currentRadius,this._currentRadius),this.translate(this._currentTail.x,this._currentTail.y,this._currentTail.z),this._attrPos.setXYZ(96,0,0,0),this._attrPos.setXYZ(97,this._currentTail.x,this._currentTail.y,this._currentTail.z),this._attrPos.needsUpdate=!0}_buildIndex(){for(let n=0;n<32;n++){const e=(n+1)%32;this._attrIndex.setXY(n*2,n,e),this._attrIndex.setXY(64+n*2,32+n,32+e),this._attrIndex.setXY(128+n*2,64+n,64+e)}this._attrIndex.setXY(192,96,97),this._attrIndex.needsUpdate=!0}},ja=new je,Sp=new je,po=new w,wp=new w,Cp=Math.sqrt(2)/2,sC=new je(0,0,-Cp,Cp),rC=new w(0,1,0),oC=class extends Ct{constructor(n){super(),this.matrixAutoUpdate=!1,this.vrmLookAt=n;{const e=new Mp;e.radius=.5;const t=new dn({color:65280,transparent:!0,opacity:.5,side:nn,depthTest:!1,depthWrite:!1});this._meshPitch=new Me(e,t),this.add(this._meshPitch)}{const e=new Mp;e.radius=.5;const t=new dn({color:16711680,transparent:!0,opacity:.5,side:nn,depthTest:!1,depthWrite:!1});this._meshYaw=new Me(e,t),this.add(this._meshYaw)}{const e=new iC;e.radius=.1;const t=new Ts({color:16777215,depthTest:!1,depthWrite:!1});this._lineTarget=new ia(e,t),this._lineTarget.frustumCulled=!1,this.add(this._lineTarget)}}dispose(){this._meshYaw.geometry.dispose(),this._meshYaw.material.dispose(),this._meshPitch.geometry.dispose(),this._meshPitch.material.dispose(),this._lineTarget.geometry.dispose(),this._lineTarget.material.dispose()}updateMatrixWorld(n){const e=wt.DEG2RAD*this.vrmLookAt.yaw;this._meshYaw.geometry.theta=e,this._meshYaw.geometry.update();const t=wt.DEG2RAD*this.vrmLookAt.pitch;this._meshPitch.geometry.theta=t,this._meshPitch.geometry.update(),this.vrmLookAt.getLookAtWorldPosition(po),this.vrmLookAt.getLookAtWorldQuaternion(ja),ja.multiply(this.vrmLookAt.getFaceFrontQuaternion(Sp)),this._meshYaw.position.copy(po),this._meshYaw.quaternion.copy(ja),this._meshPitch.position.copy(po),this._meshPitch.quaternion.copy(ja),this._meshPitch.quaternion.multiply(Sp.setFromAxisAngle(rC,e)),this._meshPitch.quaternion.multiply(sC);const{target:i,autoUpdate:s}=this.vrmLookAt;i!=null&&s&&(i.getWorldPosition(wp).sub(po),this._lineTarget.geometry.tail.copy(wp),this._lineTarget.geometry.update(),this._lineTarget.position.copy(po)),super.updateMatrixWorld(n)}},aC=new w,lC=new w;function uh(n,e){return n.matrixWorld.decompose(aC,e,lC),e}function ul(n){return[Math.atan2(-n.z,n.x),Math.atan2(n.y,Math.sqrt(n.x*n.x+n.z*n.z))]}function Ip(n){const e=Math.round(n/2/Math.PI);return n-2*Math.PI*e}var Tp=new w(0,0,1),cC=new w,uC=new w,hC=new w,dC=new je,cu=new je,Rp=new je,fC=new je,uu=new fn,bg=class yg{constructor(e,t){this.offsetFromHeadBone=new w,this.autoUpdate=!0,this.faceFront=new w(0,0,1),this.humanoid=e,this.applier=t,this._yaw=0,this._pitch=0,this._needsUpdate=!0,this._restHeadWorldQuaternion=this.getLookAtWorldQuaternion(new je)}get yaw(){return this._yaw}set yaw(e){this._yaw=e,this._needsUpdate=!0}get pitch(){return this._pitch}set pitch(e){this._pitch=e,this._needsUpdate=!0}get euler(){return console.warn("VRMLookAt: euler is deprecated. use getEuler() instead."),this.getEuler(new fn)}getEuler(e){return e.set(wt.DEG2RAD*this._pitch,wt.DEG2RAD*this._yaw,0,"YXZ")}copy(e){if(this.humanoid!==e.humanoid)throw new Error("VRMLookAt: humanoid must be same in order to copy");return this.offsetFromHeadBone.copy(e.offsetFromHeadBone),this.applier=e.applier,this.autoUpdate=e.autoUpdate,this.target=e.target,this.faceFront.copy(e.faceFront),this}clone(){return new yg(this.humanoid,this.applier).copy(this)}reset(){this._yaw=0,this._pitch=0,this._needsUpdate=!0}getLookAtWorldPosition(e){const t=this.humanoid.getRawBoneNode("head");return e.copy(this.offsetFromHeadBone).applyMatrix4(t.matrixWorld)}getLookAtWorldQuaternion(e){const t=this.humanoid.getRawBoneNode("head");return uh(t,e)}getFaceFrontQuaternion(e){if(this.faceFront.distanceToSquared(Tp)<.01)return e.copy(this._restHeadWorldQuaternion).invert();const[t,i]=ul(this.faceFront);return uu.set(0,.5*Math.PI+t,i,"YZX"),e.setFromEuler(uu).premultiply(fC.copy(this._restHeadWorldQuaternion).invert())}getLookAtWorldDirection(e){return this.getLookAtWorldQuaternion(cu),this.getFaceFrontQuaternion(Rp),e.copy(Tp).applyQuaternion(cu).applyQuaternion(Rp).applyEuler(this.getEuler(uu))}lookAt(e){const t=dC.copy(this._restHeadWorldQuaternion).multiply(vg(this.getLookAtWorldQuaternion(cu))),i=this.getLookAtWorldPosition(uC),s=hC.copy(e).sub(i).applyQuaternion(t).normalize(),[r,o]=ul(this.faceFront),[a,l]=ul(s),c=Ip(a-r),u=Ip(o-l);this._yaw=wt.RAD2DEG*c,this._pitch=wt.RAD2DEG*u,this._needsUpdate=!0}update(e){this.target!=null&&this.autoUpdate&&this.lookAt(this.target.getWorldPosition(cC)),this._needsUpdate&&(this._needsUpdate=!1,this.applier.applyYawPitch(this._yaw,this._pitch))}};bg.EULER_ORDER="YXZ";var pC=bg,AC=new w(0,0,1),Yn=new je,sr=new je,Tn=new fn(0,0,0,"YXZ"),hl=class{constructor(n,e,t,i,s){this.humanoid=n,this.rangeMapHorizontalInner=e,this.rangeMapHorizontalOuter=t,this.rangeMapVerticalDown=i,this.rangeMapVerticalUp=s,this.faceFront=new w(0,0,1),this._restQuatLeftEye=new je,this._restQuatRightEye=new je,this._restLeftEyeParentWorldQuat=new je,this._restRightEyeParentWorldQuat=new je;const r=this.humanoid.getRawBoneNode("leftEye"),o=this.humanoid.getRawBoneNode("rightEye");r&&(this._restQuatLeftEye.copy(r.quaternion),uh(r.parent,this._restLeftEyeParentWorldQuat)),o&&(this._restQuatRightEye.copy(o.quaternion),uh(o.parent,this._restRightEyeParentWorldQuat))}applyYawPitch(n,e){const t=this.humanoid.getRawBoneNode("leftEye"),i=this.humanoid.getRawBoneNode("rightEye"),s=this.humanoid.getNormalizedBoneNode("leftEye"),r=this.humanoid.getNormalizedBoneNode("rightEye");t&&(e<0?Tn.x=-wt.DEG2RAD*this.rangeMapVerticalDown.map(-e):Tn.x=wt.DEG2RAD*this.rangeMapVerticalUp.map(e),n<0?Tn.y=-wt.DEG2RAD*this.rangeMapHorizontalInner.map(-n):Tn.y=wt.DEG2RAD*this.rangeMapHorizontalOuter.map(n),Yn.setFromEuler(Tn),this._getWorldFaceFrontQuat(sr),s.quaternion.copy(sr).multiply(Yn).multiply(sr.invert()),Yn.copy(this._restLeftEyeParentWorldQuat),t.quaternion.copy(s.quaternion).multiply(Yn).premultiply(Yn.invert()).multiply(this._restQuatLeftEye)),i&&(e<0?Tn.x=-wt.DEG2RAD*this.rangeMapVerticalDown.map(-e):Tn.x=wt.DEG2RAD*this.rangeMapVerticalUp.map(e),n<0?Tn.y=-wt.DEG2RAD*this.rangeMapHorizontalOuter.map(-n):Tn.y=wt.DEG2RAD*this.rangeMapHorizontalInner.map(n),Yn.setFromEuler(Tn),this._getWorldFaceFrontQuat(sr),r.quaternion.copy(sr).multiply(Yn).multiply(sr.invert()),Yn.copy(this._restRightEyeParentWorldQuat),i.quaternion.copy(r.quaternion).multiply(Yn).premultiply(Yn.invert()).multiply(this._restQuatRightEye))}lookAt(n){console.warn("VRMLookAtBoneApplier: lookAt() is deprecated. use apply() instead.");const e=wt.RAD2DEG*n.y,t=wt.RAD2DEG*n.x;this.applyYawPitch(e,t)}_getWorldFaceFrontQuat(n){if(this.faceFront.distanceToSquared(AC)<.01)return n.identity();const[e,t]=ul(this.faceFront);return Tn.set(0,.5*Math.PI+e,t,"YZX"),n.setFromEuler(Tn)}};hl.type="bone";var hh=class{constructor(n,e,t,i,s){this.expressions=n,this.rangeMapHorizontalInner=e,this.rangeMapHorizontalOuter=t,this.rangeMapVerticalDown=i,this.rangeMapVerticalUp=s}applyYawPitch(n,e){e<0?(this.expressions.setValue("lookDown",0),this.expressions.setValue("lookUp",this.rangeMapVerticalUp.map(-e))):(this.expressions.setValue("lookUp",0),this.expressions.setValue("lookDown",this.rangeMapVerticalDown.map(e))),n<0?(this.expressions.setValue("lookLeft",0),this.expressions.setValue("lookRight",this.rangeMapHorizontalOuter.map(-n))):(this.expressions.setValue("lookRight",0),this.expressions.setValue("lookLeft",this.rangeMapHorizontalOuter.map(n)))}lookAt(n){console.warn("VRMLookAtBoneApplier: lookAt() is deprecated. use apply() instead.");const e=wt.RAD2DEG*n.y,t=wt.RAD2DEG*n.x;this.applyYawPitch(e,t)}};hh.type="expression";var Bp=class{constructor(n,e){this.inputMaxValue=n,this.outputScale=e}map(n){return this.outputScale*hg(n/this.inputMaxValue)}},mC=new Set(["1.0","1.0-beta"]),Ja=.01,gC=class{get name(){return"VRMLookAtLoaderPlugin"}constructor(n,e){this.parser=n,this.helperRoot=e==null?void 0:e.helperRoot}afterRoot(n){return dt(this,null,function*(){const e=n.userData.vrmHumanoid;if(e===null)return;if(e===void 0)throw new Error("VRMLookAtLoaderPlugin: vrmHumanoid is undefined. VRMHumanoidLoaderPlugin have to be used first");const t=n.userData.vrmExpressionManager;if(t!==null){if(t===void 0)throw new Error("VRMLookAtLoaderPlugin: vrmExpressionManager is undefined. VRMExpressionLoaderPlugin have to be used first");n.userData.vrmLookAt=yield this._import(n,e,t)}})}_import(n,e,t){return dt(this,null,function*(){if(e==null||t==null)return null;const i=yield this._v1Import(n,e,t);if(i)return i;const s=yield this._v0Import(n,e,t);return s||null})}_v1Import(n,e,t){return dt(this,null,function*(){var i,s,r;const o=this.parser.json;if(!(((i=o.extensionsUsed)==null?void 0:i.indexOf("VRMC_vrm"))!==-1))return null;const l=(s=o.extensions)==null?void 0:s.VRMC_vrm;if(!l)return null;const c=l.specVersion;if(!mC.has(c))return console.warn(`VRMLookAtLoaderPlugin: Unknown VRMC_vrm specVersion "${c}"`),null;const u=l.lookAt;if(!u)return null;const h=u.type==="expression"?1:10,d=this._v1ImportRangeMap(u.rangeMapHorizontalInner,h),f=this._v1ImportRangeMap(u.rangeMapHorizontalOuter,h),A=this._v1ImportRangeMap(u.rangeMapVerticalDown,h),g=this._v1ImportRangeMap(u.rangeMapVerticalUp,h);let m;u.type==="expression"?m=new hh(t,d,f,A,g):m=new hl(e,d,f,A,g);const p=this._importLookAt(e,m);return p.offsetFromHeadBone.fromArray((r=u.offsetFromHeadBone)!=null?r:[0,.06,0]),p})}_v1ImportRangeMap(n,e){var t,i;let s=(t=n==null?void 0:n.inputMaxValue)!=null?t:90;const r=(i=n==null?void 0:n.outputScale)!=null?i:e;return s<Ja&&(console.warn("VRMLookAtLoaderPlugin: inputMaxValue of a range map is too small. Consider reviewing the range map!"),s=Ja),new Bp(s,r)}_v0Import(n,e,t){return dt(this,null,function*(){var i,s,r,o;const l=(i=this.parser.json.extensions)==null?void 0:i.VRM;if(!l)return null;const c=l.firstPerson;if(!c)return null;const u=c.lookAtTypeName==="BlendShape"?1:10,h=this._v0ImportDegreeMap(c.lookAtHorizontalInner,u),d=this._v0ImportDegreeMap(c.lookAtHorizontalOuter,u),f=this._v0ImportDegreeMap(c.lookAtVerticalDown,u),A=this._v0ImportDegreeMap(c.lookAtVerticalUp,u);let g;c.lookAtTypeName==="BlendShape"?g=new hh(t,h,d,f,A):g=new hl(e,h,d,f,A);const m=this._importLookAt(e,g);return c.firstPersonBoneOffset?m.offsetFromHeadBone.set((s=c.firstPersonBoneOffset.x)!=null?s:0,(r=c.firstPersonBoneOffset.y)!=null?r:.06,-((o=c.firstPersonBoneOffset.z)!=null?o:0)):m.offsetFromHeadBone.set(0,.06,0),m.faceFront.set(0,0,-1),g instanceof hl&&g.faceFront.set(0,0,-1),m})}_v0ImportDegreeMap(n,e){var t,i;const s=n==null?void 0:n.curve;JSON.stringify(s)!=="[0,0,0,1,1,1,1,0]"&&console.warn("Curves of LookAtDegreeMap defined in VRM 0.0 are not supported");let r=(t=n==null?void 0:n.xRange)!=null?t:90;const o=(i=n==null?void 0:n.yRange)!=null?i:e;return r<Ja&&(console.warn("VRMLookAtLoaderPlugin: xRange of a degree map is too small. Consider reviewing the degree map!"),r=Ja),new Bp(r,o)}_importLookAt(n,e){const t=new pC(n,e);if(this.helperRoot){const i=new oC(t);this.helperRoot.add(i),i.renderOrder=this.helperRoot.renderOrder}return t}};function _C(n,e){return typeof n!="string"||n===""?"":(/^https?:\/\//i.test(e)&&/^\//.test(n)&&(e=e.replace(/(^https?:\/\/[^/]+).*/i,"$1")),/^(https?:)?\/\//i.test(n)||/^data:.*,.*$/i.test(n)||/^blob:.*$/i.test(n)?n:e+n)}var vC=new Set(["1.0","1.0-beta"]),xC=class{get name(){return"VRMMetaLoaderPlugin"}constructor(n,e){var t,i,s;this.parser=n,this.needThumbnailImage=(t=e==null?void 0:e.needThumbnailImage)!=null?t:!1,this.acceptLicenseUrls=(i=e==null?void 0:e.acceptLicenseUrls)!=null?i:["https://vrm.dev/licenses/1.0/"],this.acceptV0Meta=(s=e==null?void 0:e.acceptV0Meta)!=null?s:!0}afterRoot(n){return dt(this,null,function*(){n.userData.vrmMeta=yield this._import(n)})}_import(n){return dt(this,null,function*(){const e=yield this._v1Import(n);if(e!=null)return e;const t=yield this._v0Import(n);return t??null})}_v1Import(n){return dt(this,null,function*(){var e,t,i;const s=this.parser.json;if(!(((e=s.extensionsUsed)==null?void 0:e.indexOf("VRMC_vrm"))!==-1))return null;const o=(t=s.extensions)==null?void 0:t.VRMC_vrm;if(o==null)return null;const a=o.specVersion;if(!vC.has(a))return console.warn(`VRMMetaLoaderPlugin: Unknown VRMC_vrm specVersion "${a}"`),null;const l=o.meta;if(!l)return null;const c=l.licenseUrl;if(!new Set(this.acceptLicenseUrls).has(c))throw new Error(`VRMMetaLoaderPlugin: The license url "${c}" is not accepted`);let h;return this.needThumbnailImage&&l.thumbnailImage!=null&&(h=(i=yield this._extractGLTFImage(l.thumbnailImage))!=null?i:void 0),{metaVersion:"1",name:l.name,version:l.version,authors:l.authors,copyrightInformation:l.copyrightInformation,contactInformation:l.contactInformation,references:l.references,thirdPartyLicenses:l.thirdPartyLicenses,thumbnailImage:h,licenseUrl:l.licenseUrl,avatarPermission:l.avatarPermission,allowExcessivelyViolentUsage:l.allowExcessivelyViolentUsage,allowExcessivelySexualUsage:l.allowExcessivelySexualUsage,commercialUsage:l.commercialUsage,allowPoliticalOrReligiousUsage:l.allowPoliticalOrReligiousUsage,allowAntisocialOrHateUsage:l.allowAntisocialOrHateUsage,creditNotation:l.creditNotation,allowRedistribution:l.allowRedistribution,modification:l.modification,otherLicenseUrl:l.otherLicenseUrl}})}_v0Import(n){return dt(this,null,function*(){var e;const i=(e=this.parser.json.extensions)==null?void 0:e.VRM;if(!i)return null;const s=i.meta;if(!s)return null;if(!this.acceptV0Meta)throw new Error("VRMMetaLoaderPlugin: Attempted to load VRM0.0 meta but acceptV0Meta is false");let r;return this.needThumbnailImage&&s.texture!=null&&s.texture!==-1&&(r=yield this.parser.getDependency("texture",s.texture)),{metaVersion:"0",allowedUserName:s.allowedUserName,author:s.author,commercialUssageName:s.commercialUssageName,contactInformation:s.contactInformation,licenseName:s.licenseName,otherLicenseUrl:s.otherLicenseUrl,otherPermissionUrl:s.otherPermissionUrl,reference:s.reference,sexualUssageName:s.sexualUssageName,texture:r??void 0,title:s.title,version:s.version,violentUssageName:s.violentUssageName}})}_extractGLTFImage(n){return dt(this,null,function*(){var e;const i=(e=this.parser.json.images)==null?void 0:e[n];if(i==null)return console.warn(`VRMMetaLoaderPlugin: Attempt to use images[${n}] of glTF as a thumbnail but the image doesn't exist`),null;let s=i.uri;if(i.bufferView!=null){const o=yield this.parser.getDependency("bufferView",i.bufferView),a=new Blob([o],{type:i.mimeType});s=URL.createObjectURL(a)}return s==null?(console.warn(`VRMMetaLoaderPlugin: Attempt to use images[${n}] of glTF as a thumbnail but the image couldn't load properly`),null):yield new ZA().loadAsync(_C(s,this.parser.options.path)).catch(o=>(console.error(o),console.warn("VRMMetaLoaderPlugin: Failed to load a thumbnail image"),null))})}},EC=class{constructor(n){this.scene=n.scene,this.meta=n.meta,this.humanoid=n.humanoid,this.expressionManager=n.expressionManager,this.firstPerson=n.firstPerson,this.lookAt=n.lookAt}update(n){this.humanoid.update(),this.lookAt&&this.lookAt.update(n),this.expressionManager&&this.expressionManager.update()}},bC=class extends EC{constructor(n){super(n),this.materials=n.materials,this.springBoneManager=n.springBoneManager,this.nodeConstraintManager=n.nodeConstraintManager}update(n){super.update(n),this.nodeConstraintManager&&this.nodeConstraintManager.update(),this.springBoneManager&&this.springBoneManager.update(n),this.materials&&this.materials.forEach(e=>{e.update&&e.update(n)})}},yC=Object.defineProperty,Lp=Object.getOwnPropertySymbols,MC=Object.prototype.hasOwnProperty,SC=Object.prototype.propertyIsEnumerable,Dp=(n,e,t)=>e in n?yC(n,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):n[e]=t,Pp=(n,e)=>{for(var t in e||(e={}))MC.call(e,t)&&Dp(n,t,e[t]);if(Lp)for(var t of Lp(e))SC.call(e,t)&&Dp(n,t,e[t]);return n},As=(n,e,t)=>new Promise((i,s)=>{var r=l=>{try{a(t.next(l))}catch(c){s(c)}},o=l=>{try{a(t.throw(l))}catch(c){s(c)}},a=l=>l.done?i(l.value):Promise.resolve(l.value).then(r,o);a((t=t.apply(n,e)).next())}),wC={"":3e3,srgb:3001};function CC(n,e){parseInt(vs,10)>=152?n.colorSpace=e:n.encoding=wC[e]}var IC=class{get pending(){return Promise.all(this._pendings)}constructor(n,e){this._parser=n,this._materialParams=e,this._pendings=[]}assignPrimitive(n,e){e!=null&&(this._materialParams[n]=e)}assignColor(n,e,t){if(e!=null){const i=new ye().fromArray(e);t&&i.convertSRGBToLinear(),this._materialParams[n]=i}}assignTexture(n,e,t){return As(this,null,function*(){const i=As(this,null,function*(){if(e!=null){const s=yield this._parser.assignTexture(this._materialParams,n,e);if(s==null){console.warn("GLTFMToonMaterialParamsAssignHelper: Failed to load texture. The rendering result may be wrong");return}t&&CC(s,"srgb")}});return this._pendings.push(i),i})}assignTextureByIndex(n,e,t){return As(this,null,function*(){return this.assignTexture(n,e!=null?{index:e}:void 0,t)})}},TC=`// #define PHONG

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

}`,RC=`// #define PHONG

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
`,BC={None:"none"},Up={None:"none",ScreenCoordinates:"screenCoordinates"},LC={3e3:"",3001:"srgb"};function hu(n){return parseInt(vs,10)>=152?n.colorSpace:LC[n.encoding]}var DC=class extends Mn{constructor(n={}){var e;super({vertexShader:TC,fragmentShader:RC}),this.uvAnimationScrollXSpeedFactor=0,this.uvAnimationScrollYSpeedFactor=0,this.uvAnimationRotationSpeedFactor=0,this.fog=!0,this.normalMapType=na,this._ignoreVertexColor=!0,this._v0CompatShade=!1,this._debugMode=BC.None,this._outlineWidthMode=Up.None,this._isOutline=!1,n.transparentWithZWrite&&(n.depthWrite=!0),delete n.transparentWithZWrite,n.fog=!0,n.lights=!0,n.clipping=!0,this.uniforms=CA.merge([ge.common,ge.normalmap,ge.emissivemap,ge.fog,ge.lights,{litFactor:{value:new ye(1,1,1)},mapUvTransform:{value:new ze},colorAlpha:{value:1},normalMapUvTransform:{value:new ze},shadeColorFactor:{value:new ye(0,0,0)},shadeMultiplyTexture:{value:null},shadeMultiplyTextureUvTransform:{value:new ze},shadingShiftFactor:{value:0},shadingShiftTexture:{value:null},shadingShiftTextureUvTransform:{value:new ze},shadingShiftTextureScale:{value:1},shadingToonyFactor:{value:.9},giEqualizationFactor:{value:.9},matcapFactor:{value:new ye(1,1,1)},matcapTexture:{value:null},matcapTextureUvTransform:{value:new ze},parametricRimColorFactor:{value:new ye(0,0,0)},rimMultiplyTexture:{value:null},rimMultiplyTextureUvTransform:{value:new ze},rimLightingMixFactor:{value:1},parametricRimFresnelPowerFactor:{value:5},parametricRimLiftFactor:{value:0},emissive:{value:new ye(0,0,0)},emissiveIntensity:{value:1},emissiveMapUvTransform:{value:new ze},outlineWidthMultiplyTexture:{value:null},outlineWidthMultiplyTextureUvTransform:{value:new ze},outlineWidthFactor:{value:0},outlineColorFactor:{value:new ye(0,0,0)},outlineLightingMixFactor:{value:1},uvAnimationMaskTexture:{value:null},uvAnimationMaskTextureUvTransform:{value:new ze},uvAnimationScrollXOffset:{value:0},uvAnimationScrollYOffset:{value:0},uvAnimationRotationPhase:{value:0}},(e=n.uniforms)!=null?e:{}]),this.setValues(n),this._uploadUniformsWorkaround(),this.customProgramCacheKey=()=>[...Object.entries(this._generateDefines()).map(([t,i])=>`${t}:${i}`),this.matcapTexture?`matcapTextureColorSpace:${hu(this.matcapTexture)}`:"",this.shadeMultiplyTexture?`shadeMultiplyTextureColorSpace:${hu(this.shadeMultiplyTexture)}`:"",this.rimMultiplyTexture?`rimMultiplyTextureColorSpace:${hu(this.rimMultiplyTexture)}`:""].join(","),this.onBeforeCompile=t=>{const i=parseInt(vs,10),s=Object.entries(Pp(Pp({},this._generateDefines()),this.defines)).filter(([r,o])=>!!o).map(([r,o])=>`#define ${r} ${o}`).join(`
`)+`
`;t.vertexShader=s+t.vertexShader,t.fragmentShader=s+t.fragmentShader,i<154&&(t.fragmentShader=t.fragmentShader.replace("#include <colorspace_fragment>","#include <encodings_fragment>"))}}get color(){return this.uniforms.litFactor.value}set color(n){this.uniforms.litFactor.value=n}get map(){return this.uniforms.map.value}set map(n){this.uniforms.map.value=n}get normalMap(){return this.uniforms.normalMap.value}set normalMap(n){this.uniforms.normalMap.value=n}get normalScale(){return this.uniforms.normalScale.value}set normalScale(n){this.uniforms.normalScale.value=n}get emissive(){return this.uniforms.emissive.value}set emissive(n){this.uniforms.emissive.value=n}get emissiveIntensity(){return this.uniforms.emissiveIntensity.value}set emissiveIntensity(n){this.uniforms.emissiveIntensity.value=n}get emissiveMap(){return this.uniforms.emissiveMap.value}set emissiveMap(n){this.uniforms.emissiveMap.value=n}get shadeColorFactor(){return this.uniforms.shadeColorFactor.value}set shadeColorFactor(n){this.uniforms.shadeColorFactor.value=n}get shadeMultiplyTexture(){return this.uniforms.shadeMultiplyTexture.value}set shadeMultiplyTexture(n){this.uniforms.shadeMultiplyTexture.value=n}get shadingShiftFactor(){return this.uniforms.shadingShiftFactor.value}set shadingShiftFactor(n){this.uniforms.shadingShiftFactor.value=n}get shadingShiftTexture(){return this.uniforms.shadingShiftTexture.value}set shadingShiftTexture(n){this.uniforms.shadingShiftTexture.value=n}get shadingShiftTextureScale(){return this.uniforms.shadingShiftTextureScale.value}set shadingShiftTextureScale(n){this.uniforms.shadingShiftTextureScale.value=n}get shadingToonyFactor(){return this.uniforms.shadingToonyFactor.value}set shadingToonyFactor(n){this.uniforms.shadingToonyFactor.value=n}get giEqualizationFactor(){return this.uniforms.giEqualizationFactor.value}set giEqualizationFactor(n){this.uniforms.giEqualizationFactor.value=n}get matcapFactor(){return this.uniforms.matcapFactor.value}set matcapFactor(n){this.uniforms.matcapFactor.value=n}get matcapTexture(){return this.uniforms.matcapTexture.value}set matcapTexture(n){this.uniforms.matcapTexture.value=n}get parametricRimColorFactor(){return this.uniforms.parametricRimColorFactor.value}set parametricRimColorFactor(n){this.uniforms.parametricRimColorFactor.value=n}get rimMultiplyTexture(){return this.uniforms.rimMultiplyTexture.value}set rimMultiplyTexture(n){this.uniforms.rimMultiplyTexture.value=n}get rimLightingMixFactor(){return this.uniforms.rimLightingMixFactor.value}set rimLightingMixFactor(n){this.uniforms.rimLightingMixFactor.value=n}get parametricRimFresnelPowerFactor(){return this.uniforms.parametricRimFresnelPowerFactor.value}set parametricRimFresnelPowerFactor(n){this.uniforms.parametricRimFresnelPowerFactor.value=n}get parametricRimLiftFactor(){return this.uniforms.parametricRimLiftFactor.value}set parametricRimLiftFactor(n){this.uniforms.parametricRimLiftFactor.value=n}get outlineWidthMultiplyTexture(){return this.uniforms.outlineWidthMultiplyTexture.value}set outlineWidthMultiplyTexture(n){this.uniforms.outlineWidthMultiplyTexture.value=n}get outlineWidthFactor(){return this.uniforms.outlineWidthFactor.value}set outlineWidthFactor(n){this.uniforms.outlineWidthFactor.value=n}get outlineColorFactor(){return this.uniforms.outlineColorFactor.value}set outlineColorFactor(n){this.uniforms.outlineColorFactor.value=n}get outlineLightingMixFactor(){return this.uniforms.outlineLightingMixFactor.value}set outlineLightingMixFactor(n){this.uniforms.outlineLightingMixFactor.value=n}get uvAnimationMaskTexture(){return this.uniforms.uvAnimationMaskTexture.value}set uvAnimationMaskTexture(n){this.uniforms.uvAnimationMaskTexture.value=n}get uvAnimationScrollXOffset(){return this.uniforms.uvAnimationScrollXOffset.value}set uvAnimationScrollXOffset(n){this.uniforms.uvAnimationScrollXOffset.value=n}get uvAnimationScrollYOffset(){return this.uniforms.uvAnimationScrollYOffset.value}set uvAnimationScrollYOffset(n){this.uniforms.uvAnimationScrollYOffset.value=n}get uvAnimationRotationPhase(){return this.uniforms.uvAnimationRotationPhase.value}set uvAnimationRotationPhase(n){this.uniforms.uvAnimationRotationPhase.value=n}get ignoreVertexColor(){return this._ignoreVertexColor}set ignoreVertexColor(n){this._ignoreVertexColor=n,this.needsUpdate=!0}get v0CompatShade(){return this._v0CompatShade}set v0CompatShade(n){this._v0CompatShade=n,this.needsUpdate=!0}get debugMode(){return this._debugMode}set debugMode(n){this._debugMode=n,this.needsUpdate=!0}get outlineWidthMode(){return this._outlineWidthMode}set outlineWidthMode(n){this._outlineWidthMode=n,this.needsUpdate=!0}get isOutline(){return this._isOutline}set isOutline(n){this._isOutline=n,this.needsUpdate=!0}get isMToonMaterial(){return!0}update(n){this._uploadUniformsWorkaround(),this._updateUVAnimation(n)}copy(n){return super.copy(n),this.map=n.map,this.normalMap=n.normalMap,this.emissiveMap=n.emissiveMap,this.shadeMultiplyTexture=n.shadeMultiplyTexture,this.shadingShiftTexture=n.shadingShiftTexture,this.matcapTexture=n.matcapTexture,this.rimMultiplyTexture=n.rimMultiplyTexture,this.outlineWidthMultiplyTexture=n.outlineWidthMultiplyTexture,this.uvAnimationMaskTexture=n.uvAnimationMaskTexture,this.normalMapType=n.normalMapType,this.uvAnimationScrollXSpeedFactor=n.uvAnimationScrollXSpeedFactor,this.uvAnimationScrollYSpeedFactor=n.uvAnimationScrollYSpeedFactor,this.uvAnimationRotationSpeedFactor=n.uvAnimationRotationSpeedFactor,this.ignoreVertexColor=n.ignoreVertexColor,this.v0CompatShade=n.v0CompatShade,this.debugMode=n.debugMode,this.outlineWidthMode=n.outlineWidthMode,this.isOutline=n.isOutline,this.needsUpdate=!0,this}_updateUVAnimation(n){this.uniforms.uvAnimationScrollXOffset.value+=n*this.uvAnimationScrollXSpeedFactor,this.uniforms.uvAnimationScrollYOffset.value+=n*this.uvAnimationScrollYSpeedFactor,this.uniforms.uvAnimationRotationPhase.value+=n*this.uvAnimationRotationSpeedFactor,this.uniforms.alphaTest.value=this.alphaTest,this.uniformsNeedUpdate=!0}_uploadUniformsWorkaround(){this.uniforms.opacity.value=this.opacity,this._updateTextureMatrix(this.uniforms.map,this.uniforms.mapUvTransform),this._updateTextureMatrix(this.uniforms.normalMap,this.uniforms.normalMapUvTransform),this._updateTextureMatrix(this.uniforms.emissiveMap,this.uniforms.emissiveMapUvTransform),this._updateTextureMatrix(this.uniforms.shadeMultiplyTexture,this.uniforms.shadeMultiplyTextureUvTransform),this._updateTextureMatrix(this.uniforms.shadingShiftTexture,this.uniforms.shadingShiftTextureUvTransform),this._updateTextureMatrix(this.uniforms.matcapTexture,this.uniforms.matcapTextureUvTransform),this._updateTextureMatrix(this.uniforms.rimMultiplyTexture,this.uniforms.rimMultiplyTextureUvTransform),this._updateTextureMatrix(this.uniforms.outlineWidthMultiplyTexture,this.uniforms.outlineWidthMultiplyTextureUvTransform),this._updateTextureMatrix(this.uniforms.uvAnimationMaskTexture,this.uniforms.uvAnimationMaskTextureUvTransform),this.uniformsNeedUpdate=!0}_generateDefines(){const n=parseInt(vs,10),e=this.outlineWidthMultiplyTexture!==null,t=this.map!==null||this.normalMap!==null||this.emissiveMap!==null||this.shadeMultiplyTexture!==null||this.shadingShiftTexture!==null||this.rimMultiplyTexture!==null||this.uvAnimationMaskTexture!==null;return{THREE_VRM_THREE_REVISION:n,OUTLINE:this._isOutline,MTOON_USE_UV:e||t,MTOON_UVS_VERTEX_ONLY:e&&!t,V0_COMPAT_SHADE:this._v0CompatShade,USE_SHADEMULTIPLYTEXTURE:this.shadeMultiplyTexture!==null,USE_SHADINGSHIFTTEXTURE:this.shadingShiftTexture!==null,USE_MATCAPTEXTURE:this.matcapTexture!==null,USE_RIMMULTIPLYTEXTURE:this.rimMultiplyTexture!==null,USE_OUTLINEWIDTHMULTIPLYTEXTURE:this._isOutline&&this.outlineWidthMultiplyTexture!==null,USE_UVANIMATIONMASKTEXTURE:this.uvAnimationMaskTexture!==null,IGNORE_VERTEX_COLOR:this._ignoreVertexColor===!0,DEBUG_NORMAL:this._debugMode==="normal",DEBUG_LITSHADERATE:this._debugMode==="litShadeRate",DEBUG_UV:this._debugMode==="uv",OUTLINE_WIDTH_SCREEN:this._isOutline&&this._outlineWidthMode===Up.ScreenCoordinates}}_updateTextureMatrix(n,e){n.value&&(n.value.matrixAutoUpdate&&n.value.updateMatrix(),e.value.copy(n.value.matrix))}},PC=new Set(["1.0","1.0-beta"]),Mg=class dl{get name(){return dl.EXTENSION_NAME}constructor(e,t={}){var i,s,r,o;this.parser=e,this.materialType=(i=t.materialType)!=null?i:DC,this.renderOrderOffset=(s=t.renderOrderOffset)!=null?s:0,this.v0CompatShade=(r=t.v0CompatShade)!=null?r:!1,this.debugMode=(o=t.debugMode)!=null?o:"none",this._mToonMaterialSet=new Set}beforeRoot(){return As(this,null,function*(){this._removeUnlitExtensionIfMToonExists()})}afterRoot(e){return As(this,null,function*(){e.userData.vrmMToonMaterials=Array.from(this._mToonMaterialSet)})}getMaterialType(e){return this._getMToonExtension(e)?this.materialType:null}extendMaterialParams(e,t){const i=this._getMToonExtension(e);return i?this._extendMaterialParams(i,t):null}loadMesh(e){return As(this,null,function*(){var t;const i=this.parser,r=(t=i.json.meshes)==null?void 0:t[e];if(r==null)throw new Error(`MToonMaterialLoaderPlugin: Attempt to use meshes[${e}] of glTF but the mesh doesn't exist`);const o=r.primitives,a=yield i.loadMesh(e);if(o.length===1){const l=a,c=o[0].material;c!=null&&this._setupPrimitive(l,c)}else{const l=a;for(let c=0;c<o.length;c++){const u=l.children[c],h=o[c].material;h!=null&&this._setupPrimitive(u,h)}}return a})}_removeUnlitExtensionIfMToonExists(){const i=this.parser.json.materials;i==null||i.map((s,r)=>{var o;this._getMToonExtension(r)&&((o=s.extensions)!=null&&o.KHR_materials_unlit)&&delete s.extensions.KHR_materials_unlit})}_getMToonExtension(e){var t,i;const o=(t=this.parser.json.materials)==null?void 0:t[e];if(o==null){console.warn(`MToonMaterialLoaderPlugin: Attempt to use materials[${e}] of glTF but the material doesn't exist`);return}const a=(i=o.extensions)==null?void 0:i[dl.EXTENSION_NAME];if(a==null)return;const l=a.specVersion;if(!PC.has(l)){console.warn(`MToonMaterialLoaderPlugin: Unknown ${dl.EXTENSION_NAME} specVersion "${l}"`);return}return a}_extendMaterialParams(e,t){return As(this,null,function*(){var i;delete t.metalness,delete t.roughness;const s=new IC(this.parser,t);s.assignPrimitive("transparentWithZWrite",e.transparentWithZWrite),s.assignColor("shadeColorFactor",e.shadeColorFactor),s.assignTexture("shadeMultiplyTexture",e.shadeMultiplyTexture,!0),s.assignPrimitive("shadingShiftFactor",e.shadingShiftFactor),s.assignTexture("shadingShiftTexture",e.shadingShiftTexture,!0),s.assignPrimitive("shadingShiftTextureScale",(i=e.shadingShiftTexture)==null?void 0:i.scale),s.assignPrimitive("shadingToonyFactor",e.shadingToonyFactor),s.assignPrimitive("giEqualizationFactor",e.giEqualizationFactor),s.assignColor("matcapFactor",e.matcapFactor),s.assignTexture("matcapTexture",e.matcapTexture,!0),s.assignColor("parametricRimColorFactor",e.parametricRimColorFactor),s.assignTexture("rimMultiplyTexture",e.rimMultiplyTexture,!0),s.assignPrimitive("rimLightingMixFactor",e.rimLightingMixFactor),s.assignPrimitive("parametricRimFresnelPowerFactor",e.parametricRimFresnelPowerFactor),s.assignPrimitive("parametricRimLiftFactor",e.parametricRimLiftFactor),s.assignPrimitive("outlineWidthMode",e.outlineWidthMode),s.assignPrimitive("outlineWidthFactor",e.outlineWidthFactor),s.assignTexture("outlineWidthMultiplyTexture",e.outlineWidthMultiplyTexture,!1),s.assignColor("outlineColorFactor",e.outlineColorFactor),s.assignPrimitive("outlineLightingMixFactor",e.outlineLightingMixFactor),s.assignTexture("uvAnimationMaskTexture",e.uvAnimationMaskTexture,!1),s.assignPrimitive("uvAnimationScrollXSpeedFactor",e.uvAnimationScrollXSpeedFactor),s.assignPrimitive("uvAnimationScrollYSpeedFactor",e.uvAnimationScrollYSpeedFactor),s.assignPrimitive("uvAnimationRotationSpeedFactor",e.uvAnimationRotationSpeedFactor),s.assignPrimitive("v0CompatShade",this.v0CompatShade),s.assignPrimitive("debugMode",this.debugMode),yield s.pending})}_setupPrimitive(e,t){const i=this._getMToonExtension(t);if(i){const s=this._parseRenderOrder(i);e.renderOrder=s+this.renderOrderOffset,this._generateOutline(e),this._addToMaterialSet(e);return}}_shouldGenerateOutline(e){return typeof e.outlineWidthMode=="string"&&e.outlineWidthMode!=="none"&&typeof e.outlineWidthFactor=="number"&&e.outlineWidthFactor>0}_generateOutline(e){const t=e.material;if(!(t instanceof An)||!this._shouldGenerateOutline(t))return;e.material=[t];const i=t.clone();i.name+=" (Outline)",i.isOutline=!0,i.side=Yt,e.material.push(i);const s=e.geometry,r=s.index?s.index.count:s.attributes.position.count/3;s.addGroup(0,r,0),s.addGroup(0,r,1)}_addToMaterialSet(e){const t=e.material,i=new Set;Array.isArray(t)?t.forEach(s=>i.add(s)):i.add(t);for(const s of i)this._mToonMaterialSet.add(s)}_parseRenderOrder(e){var t;return(e.transparentWithZWrite?0:19)+((t=e.renderQueueOffsetNumber)!=null?t:0)}};Mg.EXTENSION_NAME="VRMC_materials_mtoon";var UC=Mg,FC=(n,e,t)=>new Promise((i,s)=>{var r=l=>{try{a(t.next(l))}catch(c){s(c)}},o=l=>{try{a(t.throw(l))}catch(c){s(c)}},a=l=>l.done?i(l.value):Promise.resolve(l.value).then(r,o);a((t=t.apply(n,e)).next())}),Sg=class dh{get name(){return dh.EXTENSION_NAME}constructor(e){this.parser=e}extendMaterialParams(e,t){return FC(this,null,function*(){const i=this._getHDREmissiveMultiplierExtension(e);if(i==null)return;console.warn("VRMMaterialsHDREmissiveMultiplierLoaderPlugin: `VRMC_materials_hdr_emissiveMultiplier` is archived. Use `KHR_materials_emissive_strength` instead.");const s=i.emissiveMultiplier;t.emissiveIntensity=s})}_getHDREmissiveMultiplierExtension(e){var t,i;const o=(t=this.parser.json.materials)==null?void 0:t[e];if(o==null){console.warn(`VRMMaterialsHDREmissiveMultiplierLoaderPlugin: Attempt to use materials[${e}] of glTF but the material doesn't exist`);return}const a=(i=o.extensions)==null?void 0:i[dh.EXTENSION_NAME];if(a!=null)return a}};Sg.EXTENSION_NAME="VRMC_materials_hdr_emissiveMultiplier";var NC=Sg,OC=Object.defineProperty,kC=Object.defineProperties,QC=Object.getOwnPropertyDescriptors,Fp=Object.getOwnPropertySymbols,HC=Object.prototype.hasOwnProperty,GC=Object.prototype.propertyIsEnumerable,Np=(n,e,t)=>e in n?OC(n,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):n[e]=t,jn=(n,e)=>{for(var t in e||(e={}))HC.call(e,t)&&Np(n,t,e[t]);if(Fp)for(var t of Fp(e))GC.call(e,t)&&Np(n,t,e[t]);return n},Op=(n,e)=>kC(n,QC(e)),zC=(n,e,t)=>new Promise((i,s)=>{var r=l=>{try{a(t.next(l))}catch(c){s(c)}},o=l=>{try{a(t.throw(l))}catch(c){s(c)}},a=l=>l.done?i(l.value):Promise.resolve(l.value).then(r,o);a((t=t.apply(n,e)).next())});function rr(n){return Math.pow(n,2.2)}var VC=class{get name(){return"VRMMaterialsV0CompatPlugin"}constructor(n){var e;this.parser=n,this._renderQueueMapTransparent=new Map,this._renderQueueMapTransparentZWrite=new Map;const t=this.parser.json;t.extensionsUsed=(e=t.extensionsUsed)!=null?e:[],t.extensionsUsed.indexOf("KHR_texture_transform")===-1&&t.extensionsUsed.push("KHR_texture_transform")}beforeRoot(){return zC(this,null,function*(){var n;const e=this.parser.json,t=(n=e.extensions)==null?void 0:n.VRM,i=t==null?void 0:t.materialProperties;i&&(this._populateRenderQueueMap(i),i.forEach((s,r)=>{var o,a;const l=(o=e.materials)==null?void 0:o[r];if(l==null){console.warn(`VRMMaterialsV0CompatPlugin: Attempt to use materials[${r}] of glTF but the material doesn't exist`);return}if(s.shader==="VRM/MToon"){const c=this._parseV0MToonProperties(s,l);e.materials[r]=c}else if((a=s.shader)!=null&&a.startsWith("VRM/Unlit")){const c=this._parseV0UnlitProperties(s,l);e.materials[r]=c}else s.shader==="VRM_USE_GLTFSHADER"||console.warn(`VRMMaterialsV0CompatPlugin: Unknown shader: ${s.shader}`)}))})}_parseV0MToonProperties(n,e){var t,i,s,r,o,a,l,c,u,h,d,f,A,g,m,p,E,v,_,x,S,I,L,y,b,R,U,N,G,V,P,Y,H,te,se,ae,ve,Oe,Ke,$e,K,ne,be,Le,Se,re,Ie,B,$,j,q,Z,Ae,oe,pe;const We=(i=(t=n.keywordMap)==null?void 0:t._ALPHABLEND_ON)!=null?i:!1,T=((s=n.floatProperties)==null?void 0:s._ZWrite)===1&&We,M=this._v0ParseRenderQueue(n),k=(o=(r=n.keywordMap)==null?void 0:r._ALPHATEST_ON)!=null?o:!1,X=We?"BLEND":k?"MASK":"OPAQUE",ie=k?(l=(a=n.floatProperties)==null?void 0:a._Cutoff)!=null?l:.5:void 0,De=((u=(c=n.floatProperties)==null?void 0:c._CullMode)!=null?u:2)===0,he=this._portTextureTransform(n),Be=((d=(h=n.vectorProperties)==null?void 0:h._Color)!=null?d:[1,1,1,1]).map((z,W)=>W===3?z:rr(z)),Te=(f=n.textureProperties)==null?void 0:f._MainTex,ue=Te!=null?{index:Te,extensions:jn({},he)}:void 0,xe=(g=(A=n.floatProperties)==null?void 0:A._BumpScale)!=null?g:1,He=(m=n.textureProperties)==null?void 0:m._BumpMap,Fe=He!=null?{index:He,scale:xe,extensions:jn({},he)}:void 0,_e=((E=(p=n.vectorProperties)==null?void 0:p._EmissionColor)!=null?E:[0,0,0,1]).map(rr),Je=(v=n.textureProperties)==null?void 0:v._EmissionMap,D=Je!=null?{index:Je,extensions:jn({},he)}:void 0,de=((x=(_=n.vectorProperties)==null?void 0:_._ShadeColor)!=null?x:[.97,.81,.86,1]).map(rr),me=(S=n.textureProperties)==null?void 0:S._ShadeTexture,we=me!=null?{index:me,extensions:jn({},he)}:void 0;let le=(L=(I=n.floatProperties)==null?void 0:I._ShadeShift)!=null?L:0,ee=(b=(y=n.floatProperties)==null?void 0:y._ShadeToony)!=null?b:.9;ee=wt.lerp(ee,1,.5+.5*le),le=-le-(1-ee);const Re=(U=(R=n.floatProperties)==null?void 0:R._IndirectLightIntensity)!=null?U:.1,Ye=Re?1-Re:void 0,At=(N=n.textureProperties)==null?void 0:N._SphereAdd,ut=At!=null?[1,1,1]:void 0,Nn=At!=null?{index:At}:void 0,Sn=(V=(G=n.floatProperties)==null?void 0:G._RimLightingMix)!=null?V:0,Yr=(P=n.textureProperties)==null?void 0:P._RimTexture,ui=Yr!=null?{index:Yr,extensions:jn({},he)}:void 0,jr=((H=(Y=n.vectorProperties)==null?void 0:Y._RimColor)!=null?H:[0,0,0,1]).map(rr),aa=(se=(te=n.floatProperties)==null?void 0:te._RimFresnelPower)!=null?se:1,la=(ve=(ae=n.floatProperties)==null?void 0:ae._RimLift)!=null?ve:0,Bs=["none","worldCoordinates","screenCoordinates"][(Ke=(Oe=n.floatProperties)==null?void 0:Oe._OutlineWidthMode)!=null?Ke:0];let Ls=(K=($e=n.floatProperties)==null?void 0:$e._OutlineWidth)!=null?K:0;Ls=.01*Ls;const zi=(ne=n.textureProperties)==null?void 0:ne._OutlineWidthTexture,ca=zi!=null?{index:zi,extensions:jn({},he)}:void 0,ua=((Le=(be=n.vectorProperties)==null?void 0:be._OutlineColor)!=null?Le:[0,0,0]).map(rr),Zl=((re=(Se=n.floatProperties)==null?void 0:Se._OutlineColorMode)!=null?re:0)===1?(B=(Ie=n.floatProperties)==null?void 0:Ie._OutlineLightingMix)!=null?B:1:0,ha=($=n.textureProperties)==null?void 0:$._UvAnimMaskTexture,$l=ha!=null?{index:ha,extensions:jn({},he)}:void 0,ec=(q=(j=n.floatProperties)==null?void 0:j._UvAnimScrollX)!=null?q:0;let Ds=(Ae=(Z=n.floatProperties)==null?void 0:Z._UvAnimScrollY)!=null?Ae:0;Ds!=null&&(Ds=-Ds);const C=(pe=(oe=n.floatProperties)==null?void 0:oe._UvAnimRotation)!=null?pe:0,F={specVersion:"1.0",transparentWithZWrite:T,renderQueueOffsetNumber:M,shadeColorFactor:de,shadeMultiplyTexture:we,shadingShiftFactor:le,shadingToonyFactor:ee,giEqualizationFactor:Ye,matcapFactor:ut,matcapTexture:Nn,rimLightingMixFactor:Sn,rimMultiplyTexture:ui,parametricRimColorFactor:jr,parametricRimFresnelPowerFactor:aa,parametricRimLiftFactor:la,outlineWidthMode:Bs,outlineWidthFactor:Ls,outlineWidthMultiplyTexture:ca,outlineColorFactor:ua,outlineLightingMixFactor:Zl,uvAnimationMaskTexture:$l,uvAnimationScrollXSpeedFactor:ec,uvAnimationScrollYSpeedFactor:Ds,uvAnimationRotationSpeedFactor:C};return Op(jn({},e),{pbrMetallicRoughness:{baseColorFactor:Be,baseColorTexture:ue},normalTexture:Fe,emissiveTexture:D,emissiveFactor:_e,alphaMode:X,alphaCutoff:ie,doubleSided:De,extensions:{VRMC_materials_mtoon:F}})}_parseV0UnlitProperties(n,e){var t,i,s,r,o;const a=n.shader==="VRM/UnlitTransparentZWrite",l=n.shader==="VRM/UnlitTransparent"||a,c=this._v0ParseRenderQueue(n),u=n.shader==="VRM/UnlitCutout",h=l?"BLEND":u?"MASK":"OPAQUE",d=u?(i=(t=n.floatProperties)==null?void 0:t._Cutoff)!=null?i:.5:void 0,f=this._portTextureTransform(n),A=((r=(s=n.vectorProperties)==null?void 0:s._Color)!=null?r:[1,1,1,1]).map(rr),g=(o=n.textureProperties)==null?void 0:o._MainTex,m=g!=null?{index:g,extensions:jn({},f)}:void 0,p={specVersion:"1.0",transparentWithZWrite:a,renderQueueOffsetNumber:c,shadeColorFactor:A,shadeMultiplyTexture:m};return Op(jn({},e),{pbrMetallicRoughness:{baseColorFactor:A,baseColorTexture:m},alphaMode:h,alphaCutoff:d,extensions:{VRMC_materials_mtoon:p}})}_portTextureTransform(n){var e,t,i,s,r;const o=(e=n.vectorProperties)==null?void 0:e._MainTex;if(o==null)return{};const a=[(t=o==null?void 0:o[0])!=null?t:0,(i=o==null?void 0:o[1])!=null?i:0],l=[(s=o==null?void 0:o[2])!=null?s:1,(r=o==null?void 0:o[3])!=null?r:1];return a[1]=1-l[1]-a[1],{KHR_texture_transform:{offset:a,scale:l}}}_v0ParseRenderQueue(n){var e,t;const i=n.shader==="VRM/UnlitTransparentZWrite",s=((e=n.keywordMap)==null?void 0:e._ALPHABLEND_ON)!=null||n.shader==="VRM/UnlitTransparent"||i,r=((t=n.floatProperties)==null?void 0:t._ZWrite)===1||i;let o=0;if(s){const a=n.renderQueue;a!=null&&(r?o=this._renderQueueMapTransparentZWrite.get(a):o=this._renderQueueMapTransparent.get(a))}return o}_populateRenderQueueMap(n){const e=new Set,t=new Set;n.forEach(i=>{var s,r;const o=i.shader==="VRM/UnlitTransparentZWrite",a=((s=i.keywordMap)==null?void 0:s._ALPHABLEND_ON)!=null||i.shader==="VRM/UnlitTransparent"||o,l=((r=i.floatProperties)==null?void 0:r._ZWrite)===1||o;if(a){const c=i.renderQueue;c!=null&&(l?t.add(c):e.add(c))}}),e.size>10&&console.warn(`VRMMaterialsV0CompatPlugin: This VRM uses ${e.size} render queues for Transparent materials while VRM 1.0 only supports up to 10 render queues. The model might not be rendered correctly.`),t.size>10&&console.warn(`VRMMaterialsV0CompatPlugin: This VRM uses ${t.size} render queues for TransparentZWrite materials while VRM 1.0 only supports up to 10 render queues. The model might not be rendered correctly.`),Array.from(e).sort().forEach((i,s)=>{const r=Math.min(Math.max(s-e.size+1,-9),0);this._renderQueueMapTransparent.set(i,r)}),Array.from(t).sort().forEach((i,s)=>{const r=Math.min(Math.max(s,0),9);this._renderQueueMapTransparentZWrite.set(i,r)})}},kp=(n,e,t)=>new Promise((i,s)=>{var r=l=>{try{a(t.next(l))}catch(c){s(c)}},o=l=>{try{a(t.throw(l))}catch(c){s(c)}},a=l=>l.done?i(l.value):Promise.resolve(l.value).then(r,o);a((t=t.apply(n,e)).next())}),Ni=new w,du=class extends Ct{constructor(n){super(),this._attrPosition=new it(new Float32Array([0,0,0,0,0,0]),3),this._attrPosition.setUsage(fs);const e=new mt;e.setAttribute("position",this._attrPosition);const t=new Ts({color:16711935,depthTest:!1,depthWrite:!1});this._line=new Wl(e,t),this.add(this._line),this.constraint=n}updateMatrixWorld(n){Ni.setFromMatrixPosition(this.constraint.destination.matrixWorld),this._attrPosition.setXYZ(0,Ni.x,Ni.y,Ni.z),this.constraint.source&&Ni.setFromMatrixPosition(this.constraint.source.matrixWorld),this._attrPosition.setXYZ(1,Ni.x,Ni.y,Ni.z),this._attrPosition.needsUpdate=!0,super.updateMatrixWorld(n)}};function Qp(n,e){return e.set(n.elements[12],n.elements[13],n.elements[14])}var WC=new w,qC=new w;function XC(n,e){return n.decompose(WC,e,qC),e}function Pl(n){return n.invert?n.invert():n.inverse(),n}var $h=class{constructor(n,e){this.destination=n,this.source=e,this.weight=1}},YC=new w,jC=new w,JC=new w,KC=new je,ZC=new je,$C=new je,eI=class extends $h{get aimAxis(){return this._aimAxis}set aimAxis(n){this._aimAxis=n,this._v3AimAxis.set(n==="PositiveX"?1:n==="NegativeX"?-1:0,n==="PositiveY"?1:n==="NegativeY"?-1:0,n==="PositiveZ"?1:n==="NegativeZ"?-1:0)}get dependencies(){const n=new Set([this.source]);return this.destination.parent&&n.add(this.destination.parent),n}constructor(n,e){super(n,e),this._aimAxis="PositiveX",this._v3AimAxis=new w(1,0,0),this._dstRestQuat=new je}setInitState(){this._dstRestQuat.copy(this.destination.quaternion)}update(){this.destination.updateWorldMatrix(!0,!1),this.source.updateWorldMatrix(!0,!1);const n=KC.identity(),e=ZC.identity();this.destination.parent&&(XC(this.destination.parent.matrixWorld,n),Pl(e.copy(n)));const t=YC.copy(this._v3AimAxis).applyQuaternion(this._dstRestQuat).applyQuaternion(n),i=Qp(this.source.matrixWorld,jC).sub(Qp(this.destination.matrixWorld,JC)).normalize(),s=$C.setFromUnitVectors(t,i).premultiply(e).multiply(n).multiply(this._dstRestQuat);this.destination.quaternion.copy(this._dstRestQuat).slerp(s,this.weight)}};function tI(n,e){const t=[n];let i=n.parent;for(;i!==null;)t.unshift(i),i=i.parent;t.forEach(s=>{e(s)})}var nI=class{constructor(){this._constraints=new Set,this._objectConstraintsMap=new Map}get constraints(){return this._constraints}addConstraint(n){this._constraints.add(n);let e=this._objectConstraintsMap.get(n.destination);e==null&&(e=new Set,this._objectConstraintsMap.set(n.destination,e)),e.add(n)}deleteConstraint(n){this._constraints.delete(n),this._objectConstraintsMap.get(n.destination).delete(n)}setInitState(){const n=new Set,e=new Set;for(const t of this._constraints)this._processConstraint(t,n,e,i=>i.setInitState())}update(){const n=new Set,e=new Set;for(const t of this._constraints)this._processConstraint(t,n,e,i=>i.update())}_processConstraint(n,e,t,i){if(t.has(n))return;if(e.has(n))throw new Error("VRMNodeConstraintManager: Circular dependency detected while updating constraints");e.add(n);const s=n.dependencies;for(const r of s)tI(r,o=>{const a=this._objectConstraintsMap.get(o);if(a)for(const l of a)this._processConstraint(l,e,t,i)});i(n),t.add(n)}},iI=new je,sI=new je,rI=class extends $h{get dependencies(){return new Set([this.source])}constructor(n,e){super(n,e),this._dstRestQuat=new je,this._invSrcRestQuat=new je}setInitState(){this._dstRestQuat.copy(this.destination.quaternion),Pl(this._invSrcRestQuat.copy(this.source.quaternion))}update(){const n=iI.copy(this._invSrcRestQuat).multiply(this.source.quaternion),e=sI.copy(this._dstRestQuat).multiply(n);this.destination.quaternion.copy(this._dstRestQuat).slerp(e,this.weight)}},oI=new w,aI=new je,lI=new je,cI=class extends $h{get rollAxis(){return this._rollAxis}set rollAxis(n){this._rollAxis=n,this._v3RollAxis.set(n==="X"?1:0,n==="Y"?1:0,n==="Z"?1:0)}get dependencies(){return new Set([this.source])}constructor(n,e){super(n,e),this._rollAxis="X",this._v3RollAxis=new w(1,0,0),this._dstRestQuat=new je,this._invDstRestQuat=new je,this._invSrcRestQuatMulDstRestQuat=new je}setInitState(){this._dstRestQuat.copy(this.destination.quaternion),Pl(this._invDstRestQuat.copy(this._dstRestQuat)),Pl(this._invSrcRestQuatMulDstRestQuat.copy(this.source.quaternion)).multiply(this._dstRestQuat)}update(){const n=aI.copy(this._invDstRestQuat).multiply(this.source.quaternion).multiply(this._invSrcRestQuatMulDstRestQuat),e=oI.copy(this._v3RollAxis).applyQuaternion(n),i=lI.setFromUnitVectors(e,this._v3RollAxis).premultiply(this._dstRestQuat).multiply(n);this.destination.quaternion.copy(this._dstRestQuat).slerp(i,this.weight)}},uI=new Set(["1.0","1.0-beta"]),wg=class Mo{get name(){return Mo.EXTENSION_NAME}constructor(e,t){this.parser=e,this.helperRoot=t==null?void 0:t.helperRoot}afterRoot(e){return kp(this,null,function*(){e.userData.vrmNodeConstraintManager=yield this._import(e)})}_import(e){return kp(this,null,function*(){var t;const i=this.parser.json;if(!(((t=i.extensionsUsed)==null?void 0:t.indexOf(Mo.EXTENSION_NAME))!==-1))return null;const r=new nI,o=yield this.parser.getDependencies("node");return o.forEach((a,l)=>{var c;const u=i.nodes[l],h=(c=u==null?void 0:u.extensions)==null?void 0:c[Mo.EXTENSION_NAME];if(h==null)return;const d=h.specVersion;if(!uI.has(d)){console.warn(`VRMNodeConstraintLoaderPlugin: Unknown ${Mo.EXTENSION_NAME} specVersion "${d}"`);return}const f=h.constraint;if(f.roll!=null){const A=this._importRollConstraint(a,o,f.roll);r.addConstraint(A)}else if(f.aim!=null){const A=this._importAimConstraint(a,o,f.aim);r.addConstraint(A)}else if(f.rotation!=null){const A=this._importRotationConstraint(a,o,f.rotation);r.addConstraint(A)}}),e.scene.updateMatrixWorld(),r.setInitState(),r})}_importRollConstraint(e,t,i){const{source:s,rollAxis:r,weight:o}=i,a=t[s],l=new cI(e,a);if(r!=null&&(l.rollAxis=r),o!=null&&(l.weight=o),this.helperRoot){const c=new du(l);this.helperRoot.add(c)}return l}_importAimConstraint(e,t,i){const{source:s,aimAxis:r,weight:o}=i,a=t[s],l=new eI(e,a);if(r!=null&&(l.aimAxis=r),o!=null&&(l.weight=o),this.helperRoot){const c=new du(l);this.helperRoot.add(c)}return l}_importRotationConstraint(e,t,i){const{source:s,weight:r}=i,o=t[s],a=new rI(e,o);if(r!=null&&(a.weight=r),this.helperRoot){const l=new du(a);this.helperRoot.add(l)}return a}};wg.EXTENSION_NAME="VRMC_node_constraint";var hI=wg,Ka=(n,e,t)=>new Promise((i,s)=>{var r=l=>{try{a(t.next(l))}catch(c){s(c)}},o=l=>{try{a(t.throw(l))}catch(c){s(c)}},a=l=>l.done?i(l.value):Promise.resolve(l.value).then(r,o);a((t=t.apply(n,e)).next())}),ed=class{},fu=new w,ns=new w,Cg=class extends ed{get type(){return"capsule"}constructor(n){var e,t,i,s;super(),this.offset=(e=n==null?void 0:n.offset)!=null?e:new w(0,0,0),this.tail=(t=n==null?void 0:n.tail)!=null?t:new w(0,0,0),this.radius=(i=n==null?void 0:n.radius)!=null?i:0,this.inside=(s=n==null?void 0:n.inside)!=null?s:!1}calculateCollision(n,e,t,i){fu.setFromMatrixPosition(n),ns.subVectors(this.tail,this.offset).applyMatrix4(n),ns.sub(fu);const s=ns.lengthSq();i.copy(e).sub(fu);const r=ns.dot(i);r<=0||(s<=r||ns.multiplyScalar(r/s),i.sub(ns));const o=i.length(),a=this.inside?this.radius-t-o:o-t-this.radius;return a<0&&(i.multiplyScalar(1/o),this.inside&&i.negate()),a}},pu=new w,Hp=new ze,Ig=class extends ed{get type(){return"plane"}constructor(n){var e,t;super(),this.offset=(e=n==null?void 0:n.offset)!=null?e:new w(0,0,0),this.normal=(t=n==null?void 0:n.normal)!=null?t:new w(0,0,1)}calculateCollision(n,e,t,i){i.setFromMatrixPosition(n),i.negate().add(e),Hp.getNormalMatrix(n),pu.copy(this.normal).applyNormalMatrix(Hp).normalize();const s=i.dot(pu)-t;return i.copy(pu),s}},dI=new w,Tg=class extends ed{get type(){return"sphere"}constructor(n){var e,t,i;super(),this.offset=(e=n==null?void 0:n.offset)!=null?e:new w(0,0,0),this.radius=(t=n==null?void 0:n.radius)!=null?t:0,this.inside=(i=n==null?void 0:n.inside)!=null?i:!1}calculateCollision(n,e,t,i){i.subVectors(e,dI.setFromMatrixPosition(n));const s=i.length(),r=this.inside?this.radius-t-s:s-t-this.radius;return r<0&&(i.multiplyScalar(1/s),this.inside&&i.negate()),r}},Jn=new w,fI=class extends mt{constructor(n){super(),this.worldScale=1,this._currentRadius=0,this._currentOffset=new w,this._currentTail=new w,this._shape=n,this._attrPos=new it(new Float32Array(396),3),this.setAttribute("position",this._attrPos),this._attrIndex=new it(new Uint16Array(264),1),this.setIndex(this._attrIndex),this._buildIndex(),this.update()}update(){let n=!1;const e=this._shape.radius/this.worldScale;this._currentRadius!==e&&(this._currentRadius=e,n=!0),this._currentOffset.equals(this._shape.offset)||(this._currentOffset.copy(this._shape.offset),n=!0);const t=Jn.copy(this._shape.tail).divideScalar(this.worldScale);this._currentTail.distanceToSquared(t)>1e-10&&(this._currentTail.copy(t),n=!0),n&&this._buildPosition()}_buildPosition(){Jn.copy(this._currentTail).sub(this._currentOffset);const n=Jn.length()/this._currentRadius;for(let i=0;i<=16;i++){const s=i/16*Math.PI;this._attrPos.setXYZ(i,-Math.sin(s),-Math.cos(s),0),this._attrPos.setXYZ(17+i,n+Math.sin(s),Math.cos(s),0),this._attrPos.setXYZ(34+i,-Math.sin(s),0,-Math.cos(s)),this._attrPos.setXYZ(51+i,n+Math.sin(s),0,Math.cos(s))}for(let i=0;i<32;i++){const s=i/16*Math.PI;this._attrPos.setXYZ(68+i,0,Math.sin(s),Math.cos(s)),this._attrPos.setXYZ(100+i,n,Math.sin(s),Math.cos(s))}const e=Math.atan2(Jn.y,Math.sqrt(Jn.x*Jn.x+Jn.z*Jn.z)),t=-Math.atan2(Jn.z,Jn.x);this.rotateZ(e),this.rotateY(t),this.scale(this._currentRadius,this._currentRadius,this._currentRadius),this.translate(this._currentOffset.x,this._currentOffset.y,this._currentOffset.z),this._attrPos.needsUpdate=!0}_buildIndex(){for(let n=0;n<34;n++){const e=(n+1)%34;this._attrIndex.setXY(n*2,n,e),this._attrIndex.setXY(68+n*2,34+n,34+e)}for(let n=0;n<32;n++){const e=(n+1)%32;this._attrIndex.setXY(136+n*2,68+n,68+e),this._attrIndex.setXY(200+n*2,100+n,100+e)}this._attrIndex.needsUpdate=!0}},pI=class extends mt{constructor(n){super(),this.worldScale=1,this._currentOffset=new w,this._currentNormal=new w,this._shape=n,this._attrPos=new it(new Float32Array(18),3),this.setAttribute("position",this._attrPos),this._attrIndex=new it(new Uint16Array(10),1),this.setIndex(this._attrIndex),this._buildIndex(),this.update()}update(){let n=!1;this._currentOffset.equals(this._shape.offset)||(this._currentOffset.copy(this._shape.offset),n=!0),this._currentNormal.equals(this._shape.normal)||(this._currentNormal.copy(this._shape.normal),n=!0),n&&this._buildPosition()}_buildPosition(){this._attrPos.setXYZ(0,-.5,-.5,0),this._attrPos.setXYZ(1,.5,-.5,0),this._attrPos.setXYZ(2,.5,.5,0),this._attrPos.setXYZ(3,-.5,.5,0),this._attrPos.setXYZ(4,0,0,0),this._attrPos.setXYZ(5,0,0,.25),this.translate(this._currentOffset.x,this._currentOffset.y,this._currentOffset.z),this.lookAt(this._currentNormal),this._attrPos.needsUpdate=!0}_buildIndex(){this._attrIndex.setXY(0,0,1),this._attrIndex.setXY(2,1,2),this._attrIndex.setXY(4,2,3),this._attrIndex.setXY(6,3,0),this._attrIndex.setXY(8,4,5),this._attrIndex.needsUpdate=!0}},AI=class extends mt{constructor(n){super(),this.worldScale=1,this._currentRadius=0,this._currentOffset=new w,this._shape=n,this._attrPos=new it(new Float32Array(288),3),this.setAttribute("position",this._attrPos),this._attrIndex=new it(new Uint16Array(192),1),this.setIndex(this._attrIndex),this._buildIndex(),this.update()}update(){let n=!1;const e=this._shape.radius/this.worldScale;this._currentRadius!==e&&(this._currentRadius=e,n=!0),this._currentOffset.equals(this._shape.offset)||(this._currentOffset.copy(this._shape.offset),n=!0),n&&this._buildPosition()}_buildPosition(){for(let n=0;n<32;n++){const e=n/16*Math.PI;this._attrPos.setXYZ(n,Math.cos(e),Math.sin(e),0),this._attrPos.setXYZ(32+n,0,Math.cos(e),Math.sin(e)),this._attrPos.setXYZ(64+n,Math.sin(e),0,Math.cos(e))}this.scale(this._currentRadius,this._currentRadius,this._currentRadius),this.translate(this._currentOffset.x,this._currentOffset.y,this._currentOffset.z),this._attrPos.needsUpdate=!0}_buildIndex(){for(let n=0;n<32;n++){const e=(n+1)%32;this._attrIndex.setXY(n*2,n,e),this._attrIndex.setXY(64+n*2,32+n,32+e),this._attrIndex.setXY(128+n*2,64+n,64+e)}this._attrIndex.needsUpdate=!0}},mI=new w,Au=class extends Ct{constructor(n){if(super(),this.matrixAutoUpdate=!1,this.collider=n,this.collider.shape instanceof Tg)this._geometry=new AI(this.collider.shape);else if(this.collider.shape instanceof Cg)this._geometry=new fI(this.collider.shape);else if(this.collider.shape instanceof Ig)this._geometry=new pI(this.collider.shape);else throw new Error("VRMSpringBoneColliderHelper: Unknown collider shape type detected");const e=new Ts({color:16711935,depthTest:!1,depthWrite:!1});this._line=new ia(this._geometry,e),this.add(this._line)}dispose(){this._geometry.dispose()}updateMatrixWorld(n){this.collider.updateWorldMatrix(!0,!1),this.matrix.copy(this.collider.matrixWorld);const e=this.matrix.elements;this._geometry.worldScale=mI.set(e[0],e[1],e[2]).length(),this._geometry.update(),super.updateMatrixWorld(n)}},gI=class extends mt{constructor(n){super(),this.worldScale=1,this._currentRadius=0,this._currentTail=new w,this._springBone=n,this._attrPos=new it(new Float32Array(294),3),this.setAttribute("position",this._attrPos),this._attrIndex=new it(new Uint16Array(194),1),this.setIndex(this._attrIndex),this._buildIndex(),this.update()}update(){let n=!1;const e=this._springBone.settings.hitRadius/this.worldScale;this._currentRadius!==e&&(this._currentRadius=e,n=!0),this._currentTail.equals(this._springBone.initialLocalChildPosition)||(this._currentTail.copy(this._springBone.initialLocalChildPosition),n=!0),n&&this._buildPosition()}_buildPosition(){for(let n=0;n<32;n++){const e=n/16*Math.PI;this._attrPos.setXYZ(n,Math.cos(e),Math.sin(e),0),this._attrPos.setXYZ(32+n,0,Math.cos(e),Math.sin(e)),this._attrPos.setXYZ(64+n,Math.sin(e),0,Math.cos(e))}this.scale(this._currentRadius,this._currentRadius,this._currentRadius),this.translate(this._currentTail.x,this._currentTail.y,this._currentTail.z),this._attrPos.setXYZ(96,0,0,0),this._attrPos.setXYZ(97,this._currentTail.x,this._currentTail.y,this._currentTail.z),this._attrPos.needsUpdate=!0}_buildIndex(){for(let n=0;n<32;n++){const e=(n+1)%32;this._attrIndex.setXY(n*2,n,e),this._attrIndex.setXY(64+n*2,32+n,32+e),this._attrIndex.setXY(128+n*2,64+n,64+e)}this._attrIndex.setXY(192,96,97),this._attrIndex.needsUpdate=!0}},_I=new w,vI=class extends Ct{constructor(n){super(),this.matrixAutoUpdate=!1,this.springBone=n,this._geometry=new gI(this.springBone);const e=new Ts({color:16776960,depthTest:!1,depthWrite:!1});this._line=new ia(this._geometry,e),this.add(this._line)}dispose(){this._geometry.dispose()}updateMatrixWorld(n){this.springBone.bone.updateWorldMatrix(!0,!1),this.matrix.copy(this.springBone.bone.matrixWorld);const e=this.matrix.elements;this._geometry.worldScale=_I.set(e[0],e[1],e[2]).length(),this._geometry.update(),super.updateMatrixWorld(n)}},mu=class extends vt{constructor(n){super(),this.colliderMatrix=new Qe,this.shape=n}updateWorldMatrix(n,e){super.updateWorldMatrix(n,e),xI(this.colliderMatrix,this.matrixWorld,this.shape.offset)}};function xI(n,e,t){const i=e.elements;n.copy(e),t&&(n.elements[12]=i[0]*t.x+i[4]*t.y+i[8]*t.z+i[12],n.elements[13]=i[1]*t.x+i[5]*t.y+i[9]*t.z+i[13],n.elements[14]=i[2]*t.x+i[6]*t.y+i[10]*t.z+i[14])}var EI=new Qe;function bI(n){return n.invert?n.invert():n.getInverse(EI.copy(n)),n}var yI=class{constructor(n){this._inverseCache=new Qe,this._shouldUpdateInverse=!0,this.matrix=n;const e={set:(t,i,s)=>(this._shouldUpdateInverse=!0,t[i]=s,!0)};this._originalElements=n.elements,n.elements=new Proxy(n.elements,e)}get inverse(){return this._shouldUpdateInverse&&(bI(this._inverseCache.copy(this.matrix)),this._shouldUpdateInverse=!1),this._inverseCache}revert(){this.matrix.elements=this._originalElements}},gu=new Qe,or=new w,Ao=new w,mo=new w,go=new w,MI=new Qe,SI=class{constructor(n,e,t={},i=[]){this._currentTail=new w,this._prevTail=new w,this._boneAxis=new w,this._worldSpaceBoneLength=0,this._center=null,this._initialLocalMatrix=new Qe,this._initialLocalRotation=new je,this._initialLocalChildPosition=new w;var s,r,o,a,l,c;this.bone=n,this.bone.matrixAutoUpdate=!1,this.child=e,this.settings={hitRadius:(s=t.hitRadius)!=null?s:0,stiffness:(r=t.stiffness)!=null?r:1,gravityPower:(o=t.gravityPower)!=null?o:0,gravityDir:(l=(a=t.gravityDir)==null?void 0:a.clone())!=null?l:new w(0,-1,0),dragForce:(c=t.dragForce)!=null?c:.4},this.colliderGroups=i}get dependencies(){const n=new Set,e=this.bone.parent;e&&n.add(e);for(let t=0;t<this.colliderGroups.length;t++)for(let i=0;i<this.colliderGroups[t].colliders.length;i++)n.add(this.colliderGroups[t].colliders[i]);return n}get center(){return this._center}set center(n){var e;(e=this._center)!=null&&e.userData.inverseCacheProxy&&(this._center.userData.inverseCacheProxy.revert(),delete this._center.userData.inverseCacheProxy),this._center=n,this._center&&(this._center.userData.inverseCacheProxy||(this._center.userData.inverseCacheProxy=new yI(this._center.matrixWorld)))}get initialLocalChildPosition(){return this._initialLocalChildPosition}get _parentMatrixWorld(){return this.bone.parent?this.bone.parent.matrixWorld:gu}setInitState(){this._initialLocalMatrix.copy(this.bone.matrix),this._initialLocalRotation.copy(this.bone.quaternion),this.child?this._initialLocalChildPosition.copy(this.child.position):this._initialLocalChildPosition.copy(this.bone.position).normalize().multiplyScalar(.07);const n=this._getMatrixWorldToCenter();this.bone.localToWorld(this._currentTail.copy(this._initialLocalChildPosition)).applyMatrix4(n),this._prevTail.copy(this._currentTail),this._boneAxis.copy(this._initialLocalChildPosition).normalize()}reset(){this.bone.quaternion.copy(this._initialLocalRotation),this.bone.updateMatrix(),this.bone.matrixWorld.multiplyMatrices(this._parentMatrixWorld,this.bone.matrix);const n=this._getMatrixWorldToCenter();this.bone.localToWorld(this._currentTail.copy(this._initialLocalChildPosition)).applyMatrix4(n),this._prevTail.copy(this._currentTail)}update(n){if(n<=0)return;this._calcWorldSpaceBoneLength();const e=Ao.copy(this._boneAxis).transformDirection(this._initialLocalMatrix).transformDirection(this._parentMatrixWorld);go.copy(this._currentTail).add(or.subVectors(this._currentTail,this._prevTail).multiplyScalar(1-this.settings.dragForce)).applyMatrix4(this._getMatrixCenterToWorld()).addScaledVector(e,this.settings.stiffness*n).addScaledVector(this.settings.gravityDir,this.settings.gravityPower*n),mo.setFromMatrixPosition(this.bone.matrixWorld),go.sub(mo).normalize().multiplyScalar(this._worldSpaceBoneLength).add(mo),this._collision(go),this._prevTail.copy(this._currentTail),this._currentTail.copy(go).applyMatrix4(this._getMatrixWorldToCenter());const t=MI.multiplyMatrices(this._parentMatrixWorld,this._initialLocalMatrix).invert();this.bone.quaternion.setFromUnitVectors(this._boneAxis,or.copy(go).applyMatrix4(t).normalize()).premultiply(this._initialLocalRotation),this.bone.updateMatrix(),this.bone.matrixWorld.multiplyMatrices(this._parentMatrixWorld,this.bone.matrix)}_collision(n){for(let e=0;e<this.colliderGroups.length;e++)for(let t=0;t<this.colliderGroups[e].colliders.length;t++){const i=this.colliderGroups[e].colliders[t],s=i.shape.calculateCollision(i.colliderMatrix,n,this.settings.hitRadius,or);if(s<0){n.addScaledVector(or,-s),n.sub(mo);const r=n.length();n.multiplyScalar(this._worldSpaceBoneLength/r).add(mo)}}}_calcWorldSpaceBoneLength(){or.setFromMatrixPosition(this.bone.matrixWorld),this.child?Ao.setFromMatrixPosition(this.child.matrixWorld):(Ao.copy(this._initialLocalChildPosition),Ao.applyMatrix4(this.bone.matrixWorld)),this._worldSpaceBoneLength=or.sub(Ao).length()}_getMatrixCenterToWorld(){return this._center?this._center.matrixWorld:gu}_getMatrixWorldToCenter(){return this._center?this._center.userData.inverseCacheProxy.inverse:gu}};function wI(n,e){const t=[];let i=n;for(;i!==null;)t.unshift(i),i=i.parent;t.forEach(s=>{e(s)})}function fh(n,e){n.children.forEach(t=>{e(t)||fh(t,e)})}function CI(n){var e;const t=new Map;for(const i of n){let s=i;do{const r=((e=t.get(s))!=null?e:0)+1;if(r===n.size)return s;t.set(s,r),s=s.parent}while(s!==null)}return null}var Gp=class{constructor(){this._joints=new Set,this._sortedJoints=[],this._hasWarnedCircularDependency=!1,this._ancestors=[],this._objectSpringBonesMap=new Map,this._isSortedJointsDirty=!1,this._relevantChildrenUpdated=this._relevantChildrenUpdated.bind(this)}get joints(){return this._joints}get springBones(){return console.warn("VRMSpringBoneManager: springBones is deprecated. use joints instead."),this._joints}get colliderGroups(){const n=new Set;return this._joints.forEach(e=>{e.colliderGroups.forEach(t=>{n.add(t)})}),Array.from(n)}get colliders(){const n=new Set;return this.colliderGroups.forEach(e=>{e.colliders.forEach(t=>{n.add(t)})}),Array.from(n)}addJoint(n){this._joints.add(n);let e=this._objectSpringBonesMap.get(n.bone);e==null&&(e=new Set,this._objectSpringBonesMap.set(n.bone,e)),e.add(n),this._isSortedJointsDirty=!0}addSpringBone(n){console.warn("VRMSpringBoneManager: addSpringBone() is deprecated. use addJoint() instead."),this.addJoint(n)}deleteJoint(n){this._joints.delete(n),this._objectSpringBonesMap.get(n.bone).delete(n),this._isSortedJointsDirty=!0}deleteSpringBone(n){console.warn("VRMSpringBoneManager: deleteSpringBone() is deprecated. use deleteJoint() instead."),this.deleteJoint(n)}setInitState(){this._sortJoints();for(let n=0;n<this._sortedJoints.length;n++){const e=this._sortedJoints[n];e.bone.updateMatrix(),e.bone.updateWorldMatrix(!1,!1),e.setInitState()}}reset(){this._sortJoints();for(let n=0;n<this._sortedJoints.length;n++){const e=this._sortedJoints[n];e.bone.updateMatrix(),e.bone.updateWorldMatrix(!1,!1),e.reset()}}update(n){this._sortJoints();for(let e=0;e<this._ancestors.length;e++)this._ancestors[e].updateWorldMatrix(e===0,!1);for(let e=0;e<this._sortedJoints.length;e++){const t=this._sortedJoints[e];t.bone.updateMatrix(),t.bone.updateWorldMatrix(!1,!1),t.update(n),fh(t.bone,this._relevantChildrenUpdated)}}_sortJoints(){if(!this._isSortedJointsDirty)return;const n=[],e=new Set,t=new Set,i=new Set;for(const r of this._joints)this._insertJointSort(r,e,t,n,i);this._sortedJoints=n;const s=CI(i);this._ancestors=[],s&&(this._ancestors.push(s),fh(s,r=>{var o,a;return((a=(o=this._objectSpringBonesMap.get(r))==null?void 0:o.size)!=null?a:0)>0?!0:(this._ancestors.push(r),!1)})),this._isSortedJointsDirty=!1}_insertJointSort(n,e,t,i,s){if(t.has(n))return;if(e.has(n)){this._hasWarnedCircularDependency||(console.warn("VRMSpringBoneManager: Circular dependency detected"),this._hasWarnedCircularDependency=!0);return}e.add(n);const r=n.dependencies;for(const o of r){let a=!1,l=null;wI(o,c=>{const u=this._objectSpringBonesMap.get(c);if(u)for(const h of u)a=!0,this._insertJointSort(h,e,t,i,s);else a||(l=c)}),l&&s.add(l)}i.push(n),t.add(n)}_relevantChildrenUpdated(n){var e,t;return((t=(e=this._objectSpringBonesMap.get(n))==null?void 0:e.size)!=null?t:0)>0?!0:(n.updateWorldMatrix(!1,!1),!1)}},zp="VRMC_springBone_extended_collider",II=new Set(["1.0","1.0-beta"]),TI=new Set(["1.0"]),Rg=class dr{get name(){return dr.EXTENSION_NAME}constructor(e,t){var i;this.parser=e,this.jointHelperRoot=t==null?void 0:t.jointHelperRoot,this.colliderHelperRoot=t==null?void 0:t.colliderHelperRoot,this.useExtendedColliders=(i=t==null?void 0:t.useExtendedColliders)!=null?i:!0}afterRoot(e){return Ka(this,null,function*(){e.userData.vrmSpringBoneManager=yield this._import(e)})}_import(e){return Ka(this,null,function*(){const t=yield this._v1Import(e);if(t!=null)return t;const i=yield this._v0Import(e);return i??null})}_v1Import(e){return Ka(this,null,function*(){var t,i,s,r,o;const a=e.parser.json;if(!(((t=a.extensionsUsed)==null?void 0:t.indexOf(dr.EXTENSION_NAME))!==-1))return null;const c=new Gp,u=yield e.parser.getDependencies("node"),h=(i=a.extensions)==null?void 0:i[dr.EXTENSION_NAME];if(!h)return null;const d=h.specVersion;if(!II.has(d))return console.warn(`VRMSpringBoneLoaderPlugin: Unknown ${dr.EXTENSION_NAME} specVersion "${d}"`),null;const f=(s=h.colliders)==null?void 0:s.map((g,m)=>{var p,E,v,_,x,S,I,L,y,b,R,U,N,G,V;const P=u[g.node];if(P==null)return console.warn(`VRMSpringBoneLoaderPlugin: The collider #${m} attempted to reference a node #${g.node} but not found. Skipping the collider`),null;const Y=g.shape,H=(p=g.extensions)==null?void 0:p[zp];if(this.useExtendedColliders&&H!=null){const te=H.specVersion;if(!TI.has(te))console.warn(`VRMSpringBoneLoaderPlugin: Unknown ${zp} specVersion "${te}". Fallbacking to the ${dr.EXTENSION_NAME} definition`);else{const se=H.shape;if(se.sphere)return this._importSphereCollider(P,{offset:new w().fromArray((E=se.sphere.offset)!=null?E:[0,0,0]),radius:(v=se.sphere.radius)!=null?v:0,inside:(_=se.sphere.inside)!=null?_:!1});if(se.capsule)return this._importCapsuleCollider(P,{offset:new w().fromArray((x=se.capsule.offset)!=null?x:[0,0,0]),radius:(S=se.capsule.radius)!=null?S:0,tail:new w().fromArray((I=se.capsule.tail)!=null?I:[0,0,0]),inside:(L=se.capsule.inside)!=null?L:!1});if(se.plane)return this._importPlaneCollider(P,{offset:new w().fromArray((y=se.plane.offset)!=null?y:[0,0,0]),normal:new w().fromArray((b=se.plane.normal)!=null?b:[0,0,1])})}}if(Y.sphere)return this._importSphereCollider(P,{offset:new w().fromArray((R=Y.sphere.offset)!=null?R:[0,0,0]),radius:(U=Y.sphere.radius)!=null?U:0,inside:!1});if(Y.capsule)return this._importCapsuleCollider(P,{offset:new w().fromArray((N=Y.capsule.offset)!=null?N:[0,0,0]),radius:(G=Y.capsule.radius)!=null?G:0,tail:new w().fromArray((V=Y.capsule.tail)!=null?V:[0,0,0]),inside:!1});console.warn(`VRMSpringBoneLoaderPlugin: The collider #${m} has no valid shape. Skipping the collider`)}),A=(r=h.colliderGroups)==null?void 0:r.map((g,m)=>{var p;return{colliders:((p=g.colliders)!=null?p:[]).map(v=>{const _=f==null?void 0:f[v];return _??(console.warn(`VRMSpringBoneLoaderPlugin: The collider group #${m} attempted to reference a collider #${v} but not found. Skipping the collider`),null)}).filter(v=>v!=null),name:g.name}});return(o=h.springs)==null||o.forEach((g,m)=>{var p;const E=g.joints,v=(p=g.colliderGroups)==null?void 0:p.map(S=>{const I=A==null?void 0:A[S];return I??(console.warn(`VRMSpringBoneLoaderPlugin: The spring #${m} attempted to reference a collider group #${S} but not found. Skipping the collider group`),null)}).filter(S=>S!=null),_=g.center!=null?u[g.center]:void 0;let x;E.forEach(S=>{if(x){const I=x.node,L=u[I],y=S.node,b=u[y],R={hitRadius:x.hitRadius,dragForce:x.dragForce,gravityPower:x.gravityPower,stiffness:x.stiffness,gravityDir:x.gravityDir!=null?new w().fromArray(x.gravityDir):void 0},U=this._importJoint(L,b,R,v);_&&(U.center=_),c.addJoint(U)}x=S})}),c.setInitState(),c})}_v0Import(e){return Ka(this,null,function*(){var t,i,s;const r=e.parser.json;if(!(((t=r.extensionsUsed)==null?void 0:t.indexOf("VRM"))!==-1))return null;const a=(i=r.extensions)==null?void 0:i.VRM,l=a==null?void 0:a.secondaryAnimation;if(!l)return null;const c=l==null?void 0:l.boneGroups;if(!c)return null;const u=new Gp,h=yield e.parser.getDependencies("node"),d=(s=l.colliderGroups)==null?void 0:s.map((f,A)=>{var g;const m=h[f.node];return m==null?(console.warn(`VRMSpringBoneLoaderPlugin: The collider group #${A} attempted to reference a node #${f.node} but not found. Skipping the collider group`),null):{colliders:((g=f.colliders)!=null?g:[]).map((E,v)=>{var _,x,S;const I=new w(0,0,0);return E.offset&&I.set((_=E.offset.x)!=null?_:0,(x=E.offset.y)!=null?x:0,E.offset.z?-E.offset.z:0),this._importSphereCollider(m,{offset:I,radius:(S=E.radius)!=null?S:0,inside:!1})})}});return c==null||c.forEach((f,A)=>{const g=f.bones;g&&g.forEach(m=>{var p,E,v,_;const x=h[m];if(x==null){console.warn(`VRMSpringBoneLoaderPlugin: The spring bone group #${A} attempted to reference a node #${m} but not found. Skipping the node`);return}const S=new w;f.gravityDir?S.set((p=f.gravityDir.x)!=null?p:0,(E=f.gravityDir.y)!=null?E:0,(v=f.gravityDir.z)!=null?v:0):S.set(0,-1,0);const I=f.center!=null?h[f.center]:void 0,L={hitRadius:f.hitRadius,dragForce:f.dragForce,gravityPower:f.gravityPower,stiffness:f.stiffiness,gravityDir:S},y=(_=f.colliderGroups)==null?void 0:_.map(b=>{const R=d==null?void 0:d[b];return R??(console.warn(`VRMSpringBoneLoaderPlugin: The spring #${A} attempted to reference a collider group #${b} but not found. Skipping the collider group`),null)}).filter(b=>b!=null);x.traverse(b=>{var R;const U=(R=b.children[0])!=null?R:null,N=this._importJoint(b,U,L,y);I&&(N.center=I),u.addJoint(N)})})}),e.scene.updateMatrixWorld(),u.setInitState(),u})}_importJoint(e,t,i,s){const r=new SI(e,t,i,s);if(this.jointHelperRoot){const o=new vI(r);this.jointHelperRoot.add(o),o.renderOrder=this.jointHelperRoot.renderOrder}return r}_importSphereCollider(e,t){const i=new Tg(t),s=new mu(i);if(e.add(s),this.colliderHelperRoot){const r=new Au(s);this.colliderHelperRoot.add(r),r.renderOrder=this.colliderHelperRoot.renderOrder}return s}_importCapsuleCollider(e,t){const i=new Cg(t),s=new mu(i);if(e.add(s),this.colliderHelperRoot){const r=new Au(s);this.colliderHelperRoot.add(r),r.renderOrder=this.colliderHelperRoot.renderOrder}return s}_importPlaneCollider(e,t){const i=new Ig(t),s=new mu(i);if(e.add(s),this.colliderHelperRoot){const r=new Au(s);this.colliderHelperRoot.add(r),r.renderOrder=this.colliderHelperRoot.renderOrder}return s}};Rg.EXTENSION_NAME="VRMC_springBone";var RI=Rg,BI=class{get name(){return"VRMLoaderPlugin"}constructor(n,e){var t,i,s,r,o,a,l,c,u,h;this.parser=n;const d=e==null?void 0:e.helperRoot,f=e==null?void 0:e.autoUpdateHumanBones;this.expressionPlugin=(t=e==null?void 0:e.expressionPlugin)!=null?t:new Xw(n),this.firstPersonPlugin=(i=e==null?void 0:e.firstPersonPlugin)!=null?i:new jw(n),this.humanoidPlugin=(s=e==null?void 0:e.humanoidPlugin)!=null?s:new nC(n,{helperRoot:d,autoUpdateHumanBones:f}),this.lookAtPlugin=(r=e==null?void 0:e.lookAtPlugin)!=null?r:new gC(n,{helperRoot:d}),this.metaPlugin=(o=e==null?void 0:e.metaPlugin)!=null?o:new xC(n),this.mtoonMaterialPlugin=(a=e==null?void 0:e.mtoonMaterialPlugin)!=null?a:new UC(n),this.materialsHDREmissiveMultiplierPlugin=(l=e==null?void 0:e.materialsHDREmissiveMultiplierPlugin)!=null?l:new NC(n),this.materialsV0CompatPlugin=(c=e==null?void 0:e.materialsV0CompatPlugin)!=null?c:new VC(n),this.springBonePlugin=(u=e==null?void 0:e.springBonePlugin)!=null?u:new RI(n,{colliderHelperRoot:d,jointHelperRoot:d}),this.nodeConstraintPlugin=(h=e==null?void 0:e.nodeConstraintPlugin)!=null?h:new hI(n,{helperRoot:d})}beforeRoot(){return Ya(this,null,function*(){yield this.materialsV0CompatPlugin.beforeRoot(),yield this.mtoonMaterialPlugin.beforeRoot()})}loadMesh(n){return Ya(this,null,function*(){return yield this.mtoonMaterialPlugin.loadMesh(n)})}getMaterialType(n){const e=this.mtoonMaterialPlugin.getMaterialType(n);return e??null}extendMaterialParams(n,e){return Ya(this,null,function*(){yield this.materialsHDREmissiveMultiplierPlugin.extendMaterialParams(n,e),yield this.mtoonMaterialPlugin.extendMaterialParams(n,e)})}afterRoot(n){return Ya(this,null,function*(){yield this.metaPlugin.afterRoot(n),yield this.humanoidPlugin.afterRoot(n),yield this.expressionPlugin.afterRoot(n),yield this.lookAtPlugin.afterRoot(n),yield this.firstPersonPlugin.afterRoot(n),yield this.springBonePlugin.afterRoot(n),yield this.nodeConstraintPlugin.afterRoot(n),yield this.mtoonMaterialPlugin.afterRoot(n);const e=n.userData.vrmMeta,t=n.userData.vrmHumanoid;if(e&&t){const i=new bC({scene:n.scene,expressionManager:n.userData.vrmExpressionManager,firstPerson:n.userData.vrmFirstPerson,humanoid:t,lookAt:n.userData.vrmLookAt,meta:e,materials:n.userData.vrmMToonMaterials,springBoneManager:n.userData.vrmSpringBoneManager,nodeConstraintManager:n.userData.vrmNodeConstraintManager});n.userData.vrm=i}})}};function LI(n){const e=new Set;return n.traverse(t=>{if(!t.isMesh)return;const i=t;e.add(i)}),e}function Vp(n,e,t){if(e.size===1){const o=e.values().next().value;if(o.weight===1)return n[o.index]}const i=new Float32Array(n[0].count*3);let s=0;if(t)s=1;else for(const o of e)s+=o.weight;for(const o of e){const a=n[o.index],l=o.weight/s;for(let c=0;c<a.count;c++)i[c*3+0]+=a.getX(c)*l,i[c*3+1]+=a.getY(c)*l,i[c*3+2]+=a.getZ(c)*l}return new it(i,3)}function DI(n){var e;const t=LI(n.scene),i=new Map,s=(e=n.expressionManager)==null?void 0:e.expressionMap;if(s!=null)for(const[r,o]of Object.entries(s)){const a=new Set;for(const l of o.binds)if(l instanceof Dl){if(l.weight!==0)for(const c of l.primitives){let u=i.get(c);u==null&&(u=new Map,i.set(c,u));let h=u.get(r);h==null&&(h=new Set,u.set(r,h)),h.add(l)}a.add(l)}for(const l of a)o.deleteBind(l)}for(const r of t){const o=i.get(r);if(o==null)continue;const a=r.geometry.morphAttributes;r.geometry.morphAttributes={};const l=r.geometry.clone();r.geometry=l;const c=l.morphTargetsRelative,u=a.position!=null,h=a.normal!=null,d={},f={},A=[];if(u||h){u&&(d.position=[]),h&&(d.normal=[]);let g=0;for(const[m,p]of o)u&&(d.position[g]=Vp(a.position,p,c)),h&&(d.normal[g]=Vp(a.normal,p,c)),s==null||s[m].addBind(new Dl({index:g,weight:1,primitives:[r]})),f[m]=g,A.push(0),g++}l.morphAttributes=d,r.morphTargetDictionary=f,r.morphTargetInfluences=A}}function Ul(n,e,t){if(n.getComponent)return n.getComponent(e,t);{let i=n.array[e*n.itemSize+t];return n.normalized&&(i=wt.denormalize(i,n.array)),i}}function Bg(n,e,t,i){n.setComponent?n.setComponent(e,t,i):(n.normalized&&(i=wt.normalize(i,n.array)),n.array[e*n.itemSize+t]=i)}function PI(n){var e;const t=UI(n),i=new Set;for(const h of t)i.has(h.geometry)&&(h.geometry=HI(h.geometry)),i.add(h.geometry);const s=new Map;for(const h of i){const d=h.getAttribute("skinIndex"),f=(e=s.get(d))!=null?e:new Map;s.set(d,f);const A=h.getAttribute("skinWeight"),g=FI(d,A);f.set(A,g)}const r=new Map;for(const h of t){const d=NI(h,s);r.set(h,d)}const o=[];for(const[h,d]of r){let f=!1;for(const A of o)if(OI(d,A.boneInverseMap)){f=!0,A.meshes.add(h);for(const[m,p]of d)A.boneInverseMap.set(m,p);break}f||o.push({boneInverseMap:d,meshes:new Set([h])})}const a=new Map,l=new _u,c=new _u,u=new _u;for(const h of o){const{boneInverseMap:d,meshes:f}=h,A=Array.from(d.keys()),g=Array.from(d.values()),m=new Hr(A,g),p=c.getOrCreate(m);for(const E of f){const v=E.geometry.getAttribute("skinIndex"),_=l.getOrCreate(v),x=E.skeleton.bones,S=x.map(y=>u.getOrCreate(y)).join(","),I=`${_};${p};${S}`;let L=a.get(I);L==null&&(L=v.clone(),kI(L,x,A),a.set(I,L)),E.geometry.setAttribute("skinIndex",L)}for(const E of f)E.bind(m,new Qe)}}function UI(n){const e=new Set;return n.traverse(t=>{if(!t.isSkinnedMesh)return;const i=t;e.add(i)}),e}function FI(n,e){const t=new Set;for(let i=0;i<n.count;i++)for(let s=0;s<n.itemSize;s++){const r=Ul(n,i,s);Ul(e,i,s)!==0&&t.add(r)}return t}function NI(n,e){const t=new Map,i=n.skeleton,s=n.geometry,r=s.getAttribute("skinIndex"),o=s.getAttribute("skinWeight"),a=e.get(r),l=a==null?void 0:a.get(o);if(!l)throw new Error("Unreachable. attributeUsedIndexSetMap does not know the skin index attribute or the skin weight attribute.");for(const c of l)t.set(i.bones[c],i.boneInverses[c]);return t}function OI(n,e){for(const[t,i]of n.entries()){const s=e.get(t);if(s!=null&&!QI(i,s))return!1}return!0}function kI(n,e,t){const i=new Map;for(const r of e)i.set(r,i.size);const s=new Map;for(const[r,o]of t.entries()){const a=i.get(o);s.set(a,r)}for(let r=0;r<n.count;r++)for(let o=0;o<n.itemSize;o++){const a=Ul(n,r,o),l=s.get(a);Bg(n,r,o,l)}n.needsUpdate=!0}function QI(n,e,t){if(t=t||1e-4,n.elements.length!=e.elements.length)return!1;for(let i=0,s=n.elements.length;i<s;i++)if(Math.abs(n.elements[i]-e.elements[i])>t)return!1;return!0}var _u=class{constructor(){this._objectIndexMap=new Map,this._index=0}get(n){return this._objectIndexMap.get(n)}getOrCreate(n){let e=this._objectIndexMap.get(n);return e==null&&(e=this._index,this._objectIndexMap.set(n,e),this._index++),e}};function HI(n){var e,t,i,s;const r=new mt;r.name=n.name,r.setIndex(n.index);for(const[o,a]of Object.entries(n.attributes))r.setAttribute(o,a);for(const[o,a]of Object.entries(n.morphAttributes)){const l=o;r.morphAttributes[l]=a.concat()}r.morphTargetsRelative=n.morphTargetsRelative,r.groups=[];for(const o of n.groups)r.addGroup(o.start,o.count,o.materialIndex);return r.boundingSphere=(t=(e=n.boundingSphere)==null?void 0:e.clone())!=null?t:null,r.boundingBox=(s=(i=n.boundingBox)==null?void 0:i.clone())!=null?s:null,r.drawRange.start=n.drawRange.start,r.drawRange.count=n.drawRange.count,r.userData=n.userData,r}function Wp(n){if(Object.values(n).forEach(e=>{e!=null&&e.isTexture&&e.dispose()}),n.isShaderMaterial){const e=n.uniforms;e&&Object.values(e).forEach(t=>{const i=t.value;i!=null&&i.isTexture&&i.dispose()})}n.dispose()}function GI(n){const e=n.geometry;e&&e.dispose();const t=n.skeleton;t&&t.dispose();const i=n.material;i&&(Array.isArray(i)?i.forEach(s=>Wp(s)):i&&Wp(i))}function zI(n){n.traverse(GI)}function VI(n,e){var t,i;console.warn("VRMUtils.removeUnnecessaryJoints: removeUnnecessaryJoints is deprecated. Use combineSkeletons instead. combineSkeletons contributes more to the performance improvement. This function will be removed in the next major version.");const s=(t=e==null?void 0:e.experimentalSameBoneCounts)!=null?t:!1,r=[];n.traverse(l=>{l.type==="SkinnedMesh"&&r.push(l)});const o=new Map;let a=0;for(const l of r){const u=l.geometry.getAttribute("skinIndex");if(o.has(u))continue;const h=new Map,d=new Map;for(let f=0;f<u.count;f++)for(let A=0;A<u.itemSize;A++){const g=Ul(u,f,A);let m=h.get(g);m==null&&(m=h.size,h.set(g,m),d.set(m,g)),Bg(u,f,A,m)}u.needsUpdate=!0,o.set(u,d),a=Math.max(a,h.size)}for(const l of r){const u=l.geometry.getAttribute("skinIndex"),h=o.get(u),d=[],f=[],A=s?a:h.size;for(let m=0;m<A;m++){const p=(i=h.get(m))!=null?i:0;d.push(l.skeleton.bones[p]),f.push(l.skeleton.boneInverses[p])}const g=new Hr(d,f);l.bind(g,new Qe)}}function WI(n,e){const t=n.position.count,i=new Array(t);let s=0;const r=e.array;for(let o=0;o<r.length;o++){const a=r[o];i[a]||(i[a]=!0,s++)}return{isVertexUsed:i,vertexCount:t,verticesUsed:s}}function qI(n){const e=[],t=[];let i=0;for(let s=0;s<n.length;s++)if(n[s]){const r=i++;e[s]=r,t[r]=s}return{originalIndexNewIndexMap:e,newIndexOriginalIndexMap:t}}function XI(n,e){var t,i,s,r;e.name=n.name,e.morphTargetsRelative=n.morphTargetsRelative,n.groups.forEach(o=>{e.addGroup(o.start,o.count,o.materialIndex)}),e.boundingBox=(i=(t=n.boundingBox)==null?void 0:t.clone())!=null?i:null,e.boundingSphere=(r=(s=n.boundingSphere)==null?void 0:s.clone())!=null?r:null,e.setDrawRange(n.drawRange.start,n.drawRange.count),e.userData=n.userData}function YI(n,e,t){const i=e.array,s=new i.constructor(i.length);for(let r=0;r<i.length;r++){const o=i[r];s[r]=t[o]}n.setIndex(new it(s,e.itemSize,e.normalized))}function Fl(n,e,t){const i=n.constructor,s=new i(e.length*t);let r=!0;for(let o=0;o<e.length;o++){const l=e[o]*t,c=o*t;for(let u=0;u<t;u++){const h=n[l+u];s[c+u]=h,r=r&&h===0}}return[s,r]}function jI(n){var e;const t=new Map,i=[];for(const[s,r]of Object.entries(n))if(r.isInterleavedBufferAttribute){const o=r,a=o.data,l=(e=t.get(a))!=null?e:[];t.set(a,l),l.push([s,o])}else{const o=r;i.push([s,o])}return[t,i]}function JI(n,e,t){const[i,s]=jI(e);for(const[r,o]of i){const a=r.array,{stride:l}=r,[c]=Fl(a,t,l),u=new zl(c,l);u.setUsage(r.usage);for(const[h,d]of o){const{itemSize:f,offset:A,normalized:g}=d,m=new Ms(u,f,A,g);n.setAttribute(h,m)}}for(const[r,o]of s){const a=o.array,{itemSize:l,normalized:c}=o,[u]=Fl(a,t,l);n.setAttribute(r,new it(u,l,c))}}function KI(n){var e;const t=new Map,i=[];for(const[s,r]of Object.entries(n)){const o=s;for(let a=0;a<r.length;a++){const l=r[a];if(l.isInterleavedBufferAttribute){const c=l,u=c.data,h=(e=t.get(u))!=null?e:[];t.set(u,h),h.push([o,a,c])}else{const c=l;i.push([o,a,c])}}}return[t,i]}function ZI(n,e,t){var i,s;let r=!0;const[o,a]=KI(e),l={};for(const[c,u]of o){const h=c.array,{stride:d}=c,[f,A]=Fl(h,t,d);r=r&&A;const g=new zl(f,d);g.setUsage(c.usage);for(const[m,p,E]of u){const{itemSize:v,offset:_,normalized:x}=E,S=new Ms(g,v,_,x);(i=l[m])!=null||(l[m]=[]),l[m][p]=S}}for(const[c,u,h]of a){const d=h,f=d.array,{itemSize:A,normalized:g}=d,[m,p]=Fl(f,t,A);r=r&&p,(s=l[c])!=null||(l[c]=[]),l[c][u]=new it(m,A,g)}n.morphAttributes=r?{}:l}function $I(n){const e=new Map;n.traverse(t=>{if(!t.isMesh)return;const i=t,s=i.geometry,r=s.index;if(r==null)return;const o=e.get(s);if(o!=null){i.geometry=o;return}const{isVertexUsed:a,vertexCount:l,verticesUsed:c}=WI(s.attributes,r);if(c===l)return;const{originalIndexNewIndexMap:u,newIndexOriginalIndexMap:h}=qI(a),d=new mt;XI(s,d),e.set(s,d),YI(d,r,u),JI(d,s.attributes,h),ZI(d,s.morphAttributes,h),i.geometry=d}),Array.from(e.keys()).forEach(t=>{t.dispose()})}function eT(n){var e;((e=n.meta)==null?void 0:e.metaVersion)==="0"&&(n.scene.rotation.y=Math.PI)}var wi=class{constructor(){}};wi.combineMorphs=DI;wi.combineSkeletons=PI;wi.deepDispose=zI;wi.removeUnnecessaryJoints=VI;wi.removeUnnecessaryVertices=$I;wi.rotateVRM0=eT;/*!
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
 */const qp=1.75;async function tT(n,e){var r;const t=new KA;t.setURLModifier(o=>o.endsWith("basis_transcoder.js")?Gw:o.endsWith("basis_transcoder.wasm")?zw:o);const i=new XS(t);i.setCrossOrigin("anonymous"),i.setMeshoptDecoder(Hw);const s=new Pn(t).setTranscoderPath("/").setWorkerLimit(1);s.detectSupport(e),i.setKTX2Loader(s),i.register(o=>new BI(o));try{const o=await i.loadAsync(n),a=o.userData.vrm;if(!((r=a==null?void 0:a.humanoid)!=null&&r.getNormalizedBoneNode("hips")))throw wi.deepDispose(o.scene),new Error("Avatar has no VRM humanoid");return wi.removeUnnecessaryVertices(o.scene),wi.rotateVRM0(a),a.scene.traverse(l=>{l.isMesh&&(l.castShadow=!0,l.frustumCulled=!1)}),a}finally{s.dispose()}}const Lg=new w,Dg=new w,Xp=new w,Za=new je,vu=new je,_o=new fn;function Yp(n,e,t){const i=Lg.copy(e).sub(n.getWorldPosition(Xp)),s=Dg.copy(t).sub(Xp);i.lengthSq()<1e-8||s.lengthSq()<1e-8||(Za.setFromUnitVectors(i.normalize(),s.normalize()),n.getWorldQuaternion(vu),vu.premultiply(Za),n.parent.getWorldQuaternion(Za).invert(),n.quaternion.copy(Za.multiply(vu)),n.updateMatrixWorld(!0))}const ar=new w,vo=new w,$a=new w,el=new w,nT=new w,jp=new w;function Jp(n,e,t,i,s){n.getWorldPosition(ar),e.getWorldPosition(vo),t.getWorldPosition($a);const r=ar.distanceTo(vo),o=vo.distanceTo($a);el.copy(i);const a=Lg.copy(el).sub(ar);let l=a.length();if(l<1e-5)return;a.divideScalar(l),l=Math.min(l,(r+o)*.999),l=Math.max(l,Math.abs(r-o)*1.01+1e-4),el.copy(ar).addScaledVector(a,l);const c=Math.max(-1,Math.min(1,(r*r+l*l-o*o)/(2*r*l))),u=Math.sqrt(1-c*c),h=Dg.copy(s).sub(ar);h.addScaledVector(a,-h.dot(a)),h.lengthSq()<1e-8&&h.set(0,-1,0),h.normalize(),jp.copy(ar).addScaledVector(a,r*c).addScaledVector(h,r*u);const d=nT.copy(el);Yp(n,vo,jp),e.getWorldPosition(vo),t.getWorldPosition($a),Yp(e,$a,d)}const iT=["happy","sad","angry","surprised","aa","blink"],Kp={happy:{happy:1},sad:{sad:.9},shout:{aa:.7,angry:.35},focus:{angry:.3},blink:{blink:1},neutral:{}};function sT(n,e){const t=new Ct;t.name="vrm",t.rotation.y=Math.PI,t.add(e.scene),n.root.add(t),e.scene.updateMatrixWorld(!0);const i=new oi().setFromObject(e.scene),s=i.max.y-i.min.y,r=Math.max(.4,Math.min(3,qp/(s||qp)));t.scale.setScalar(r),t.position.y=-i.min.y*r;const o=d=>e.humanoid.getNormalizedBoneNode(d),a={hips:o("hips"),spine:o("spine"),chest:o("chest")||o("upperChest"),neck:o("neck"),head:o("head")},l={};for(const d of["left","right"])l[d]={upperArm:o(`${d}UpperArm`),lowerArm:o(`${d}LowerArm`),hand:o(`${d}Hand`),upperLeg:o(`${d}UpperLeg`),lowerLeg:o(`${d}LowerLeg`),foot:o(`${d}Foot`)};const c=a.hips.position.clone();n.root.updateMatrixWorld(!0);const u=l.left.foot.getWorldPosition(new w).y-n.root.position.y;n.body.visible=!1;for(const d of Object.values(n.parts))d.visible=!1;const h={vrm:e,holder:t,bones:a,limbs:l,hipsRest:c,ankle:u,scale:r};return n.rig=h,h}const Kn=new w,lr=new w,tl=new w;function nl(n,e,t,i,s){return n.localToWorld(s.set(e,t,i))}function rT(n,e){var A,g,m,p;const t=n.rig;if(!t)return;const{vrm:i,bones:s,limbs:r,scale:o}=t,a=n.root;for(const E of Object.values(s))E&&E.quaternion.identity();for(const E of Object.values(r))for(const v of Object.values(E))v&&v.quaternion.identity();const l=n.body.position.y+.06;s.hips.position.copy(t.hipsRest),s.hips.position.y+=l/o;const c=n.body.rotation,u=n.body.rotation.y;s.hips.quaternion.setFromEuler(_o.set(0,u*.25,0)),(A=s.spine)==null||A.quaternion.setFromEuler(_o.set(-c.x*.7,u*.4,-c.z*.7)),(g=s.chest)==null||g.quaternion.setFromEuler(_o.set(-c.x*.5,u*.35,-c.z*.5));const h=n.head.rotation.y,d=n.head.rotation.x;(m=s.neck)==null||m.quaternion.setFromEuler(_o.set(-d*.4,h*.4,0)),(p=s.head)==null||p.quaternion.setFromEuler(_o.set(-d*.6,h*.6,0)),t.holder.updateMatrixWorld(!0);for(const[E,v,_]of[["right",n.handR,1],["left",n.handL,-1]]){const x=r[E];!x.upperArm||!x.lowerArm||!x.hand||(nl(a,v.x,v.y,v.z,lr),x.upperArm.getWorldPosition(Kn),a.worldToLocal(Kn),nl(a,Kn.x+_*.4,Kn.y-.7,Kn.z+.35,tl),Jp(x.upperArm,x.lowerArm,x.hand,lr,tl))}for(const[E,v,_]of[["right",n.parts.footR,1],["left",n.parts.footL,-1]]){const x=r[E];if(!x.upperLeg||!x.lowerLeg||!x.foot)continue;const S=v.position;nl(a,S.x,S.y+t.ankle,S.z-.04,lr),x.upperLeg.getWorldPosition(Kn),a.worldToLocal(Kn),nl(a,Kn.x+_*.08,Kn.y-.3,Kn.z-.9,tl),Jp(x.upperLeg,x.lowerLeg,x.foot,lr,tl)}const f=i.expressionManager;if(f){const E=Kp[n.expression]||Kp.neutral;for(const v of iT){if(!f.getExpression(v))continue;const _=f.getValue(v)||0,x=E[v]||0;f.setValue(v,v==="blink"?x:_+(x-_)*Math.min(1,e*14))}}i.update(e),r.right.hand.getWorldPosition(lr),n.racket.position.copy(a.worldToLocal(lr))}const Ot={step:1/60,walkSpeed:3.2,runSpeed:5.4,acceleration:6.4,steerRate:12,brakeRate:28,restSpeed:.06,inputDeadzone:.01,jumpSpeed:6,gravity:18,maxJumps:2,faceMinSpeed:.1,maxFrame:.1,referenceHeight:1.8},St={distance:5,lookHeight:1.2,pitch:-.28,pitchMin:-.65,pitchMax:.05,fov:58,narrowFov:72,narrowWidth:600,near:.08,lookRate:18,dragYaw:.0032,dragPitch:.0025,wheelPitch:.0015,wheelMax:160,keyTurnRate:Math.PI/2},un={forward:["KeyW","ArrowUp"],back:["KeyS","ArrowDown"],left:["KeyA"],right:["KeyD"],turnLeft:["ArrowLeft"],turnRight:["ArrowRight"],run:["ShiftLeft","ShiftRight"],jump:["Space"]},oT={stickRadius:30},is={moveAxes:[0,1],lookAxes:[2,3],deadzone:.2,lookYawRate:2.6,lookPitchRate:1.6,jumpButton:0,runButtons:[10,7]},aT={settleRate:4},Uo=Ot.step,fl=(n,e,t)=>Math.max(e,Math.min(t,n)),Zp=n=>Math.atan2(Math.sin(n),Math.cos(n)),gr=n=>Number.isFinite(n)?n:0;function $p(n={}){return{x:n.x||0,y:n.y||0,z:n.z||0,rotation:n.rotation||0,vx:0,vz:0,vy:0,jumpHeld:!1,jumpCount:(n.y||0)>0?1:0,floor:!(n.y&&n.y>0),time:0}}function lT(n,e,t,i,s){s=fl(gr(s),0,Ot.maxFrame);const r=Math.abs(e)+Math.abs(t)>Ot.inputDeadzone,o=Math.max(1,Math.hypot(e,t)),a=i?Ot.runSpeed:Ot.walkSpeed,l=Math.hypot(n.vx,n.vz),c=1-Math.exp(-(r?Ot.steerRate:Ot.brakeRate)*s);n.vx+=(e/o*a-n.vx)*c,n.vz+=(t/o*a-n.vz)*c;const u=Math.hypot(n.vx,n.vz),h=l+Ot.acceleration*s;r&&u>h&&(n.vx*=h/u,n.vz*=h/u),!r&&u<Ot.restSpeed&&(n.vx=n.vz=0)}function eA(n,e,t=Uo,i=1){t=fl(gr(t),0,Uo);const s=gr(e.yaw);lT(n,fl(gr(e.strafe),-1,1),fl(gr(e.forward),-1,1),!!e.running,t),!n.y&&n.vy<=0&&(n.jumpCount=0),e.jump&&!n.jumpHeld&&n.jumpCount<Ot.maxJumps&&(n.vy=Ot.jumpSpeed,n.jumpCount++),n.jumpHeld=!!e.jump,(n.y>0||n.vy>0)&&(n.vy-=Ot.gravity*t,n.y=Math.max(0,n.y+n.vy*t*i),n.y||(n.vy=0,n.jumpCount=0));const r=Math.cos(s)*n.vx+Math.sin(s)*n.vz,o=-Math.sin(s)*n.vx+Math.cos(s)*n.vz;return n.x+=r*t*i,n.z+=o*t*i,Math.hypot(r,o)>Ot.faceMinSpeed&&(n.rotation=Zp(n.rotation+Zp(s+Math.atan2(-n.vx,-n.vz)-n.rotation)*(1-Math.exp(-12*t)))),n.floor=n.y===0,n.time+=t,n}function cT(n={},e={}){let t=$p(n),i=0,s={x:t.x,z:t.z,time:t.time};const r={get rest(){return s},get state(){return t},scale:e.scale&&e.scale>0?e.scale:1,advance(o,a){var c,u;for(i=Math.min(Ot.maxFrame,i+Math.max(0,gr(o)));i+1e-9>=Uo;)i-=Uo,eA(t,a,Uo,r.scale),(c=e.constrain)==null||c.call(e,t),!t.vx&&!t.vz&&(s={x:t.x,z:t.z,time:t.time});const l=eA({...t},a,i,r.scale);return(u=e.constrain)==null||u.call(e,l),l},place(o){const a=t.time;t=$p({...t,...o}),t.time=a,s={x:t.x,z:t.z,time:a},i=0},speed:()=>Math.hypot(t.vx,t.vz),velocity:o=>({x:(Math.cos(o)*t.vx+Math.sin(o)*t.vz)*r.scale,z:(-Math.sin(o)*t.vx+Math.cos(o)*t.vz)*r.scale})};return r}const ss=(n,e)=>e.some(t=>n.has(t)),ph=n=>Number.isFinite(n)?Math.max(0,Math.min(n,Ot.maxFrame)):0;function uT(n,e){return{strafe:Number(ss(n,un.right))-Number(ss(n,un.left)),forward:Number(ss(n,un.back))-Number(ss(n,un.forward)),turn:(Number(ss(n,un.turnLeft))-Number(ss(n,un.turnRight)))*St.keyTurnRate*ph(e),running:ss(n,un.run)}}const hT=new Set([...un.forward,...un.back,...un.left,...un.right,...un.turnLeft,...un.turnRight]);function tA(n){if(n.code)return n.code;const e=n.key??"";return e===" "||e==="Spacebar"?"Space":/^[a-z]$/i.test(e)?`Key${e.toUpperCase()}`:e==="Shift"?"ShiftLeft":e}function dT(){let n=0,e=!1,t=0;return{queue(){n=Math.min(Ot.maxJumps,n+1)},read(i){t<=1e-9&&(e?(e=!1,t=Ot.step):n&&(n--,e=!0,t=Ot.step));const s=e;return t-=Number.isFinite(i)?Math.max(0,i):0,s},clear(){n=t=0,e=!1}}}function fT(n,e,t=oT.stickRadius){let i=n/t,s=e/t;const r=Math.hypot(i,s);return r>1&&(i/=r,s/=r),{strafe:i,forward:s}}function pT(n,e){const t={strafe:0,forward:0,lookYaw:0,lookPitch:0,running:!1,jump:!1};if(!n)return t;const i=([c,u])=>{const h=n.axes[c]||0,d=n.axes[u]||0,f=Math.hypot(h,d);return f<is.deadzone?[0,0]:f>1?[h/f,d/f]:[h,d]},[s,r]=i(is.moveAxes),[o,a]=i(is.lookAxes),l=c=>{var u;return!!((u=n.buttons[c])!=null&&u.pressed)};return{strafe:s,forward:r,lookYaw:0-o*is.lookYawRate*ph(e),lookPitch:0-a*is.lookPitchRate*ph(e),running:is.runButtons.some(l),jump:l(is.jumpButton)}}const kr=(n,e,t)=>Math.max(e,Math.min(t,n)),nA=(n,e)=>1-Math.exp(-n*kr(Number.isFinite(e)?e:0,0,.1)),AT=n=>n<St.narrowWidth?St.narrowFov:St.fov;function Pg(n={}){const e=n.scale&&n.scale>0?n.scale:1,t=n.yaw||0;return{yaw:t,pitch:St.pitch,targetYaw:t,targetPitch:St.pitch,scale:e,distance:St.distance*e,look:{x:0,y:St.lookHeight*e,z:0},fov:null,fovBlend:0,settling:!1}}const Kl=n=>{n.fov===null||n.settling||(n.settling=!0,n.targetPitch=kr(n.targetPitch,St.pitchMin,St.pitchMax))};function mT(n,e,t){Kl(n),n.targetYaw-=e*St.dragYaw,n.targetPitch=kr(n.targetPitch-t*St.dragPitch,St.pitchMin,St.pitchMax)}function gT(n,e){Kl(n);const t=kr(e,-160,St.wheelMax);n.targetPitch=kr(n.targetPitch-t*St.wheelPitch,St.pitchMin,St.pitchMax)}function _T(n,e,t=0){!e&&!t||(Kl(n),n.targetYaw+=e,n.yaw+=e,n.targetPitch=kr(n.targetPitch+t,St.pitchMin,St.pitchMax))}function iA(n,e,t=!1){t&&Kl(n);const i=nA(St.lookRate,e);if(n.yaw+=(n.targetYaw-n.yaw)*i,n.pitch+=(n.targetPitch-n.pitch)*i,!n.settling)return;const s=nA(aT.settleRate,e),r=St.distance*n.scale,o=St.lookHeight*n.scale;n.distance+=(r-n.distance)*s,n.look.x+=-n.look.x*s,n.look.y+=(o-n.look.y)*s,n.look.z+=-n.look.z*s,n.fovBlend+=-n.fovBlend*s,n.fovBlend<.002&&Math.abs(n.distance-r)<.002*n.scale&&Math.hypot(n.look.x,n.look.y-o,n.look.z)<.002*n.scale&&(n.distance=r,n.look={x:0,y:o,z:0},n.settling=!1,n.fov=null,n.fovBlend=0)}function vT(n,e,t=1280){const i={x:e.x+n.look.x,y:(e.y||0)+n.look.y,z:e.z+n.look.z},s=Math.cos(n.pitch)*n.distance,r=AT(t),o=n.fov===null?r:r+(n.fov-r)*n.fovBlend;return{position:{x:i.x+Math.sin(n.yaw)*s,y:i.y-Math.sin(n.pitch)*n.distance,z:i.z+Math.cos(n.yaw)*s},target:i,fov:o,near:St.near*n.scale}}const xT=(n,e,t)=>Math.max(e,Math.min(t,n)),Bn=(n,e=NaN)=>typeof n=="number"&&Number.isFinite(n)?n:e,xo=n=>Array.isArray(n)?{x:Bn(n[0]),y:Bn(n[1]),z:Bn(n[2])}:{x:Bn(n==null?void 0:n.x),y:Bn(n==null?void 0:n.y),z:Bn(n==null?void 0:n.z)};function ET(n){const e=n;if(!e||typeof e!="object")return null;let t;if(e.camera&&e.avatar){const r=xo(e.avatar.position),o=xo(e.camera.position),a=xo(e.camera.target),[l,c,u,h]=[0,1,2,3].map(d=>{var f;return Bn((f=e.avatar.rotation)==null?void 0:f[d],d===3?1:0)});t={cameraOffset:{x:o.x-r.x,y:o.y-r.y,z:o.z-r.z},cameraTargetOffset:{x:a.x-r.x,y:a.y-r.y,z:a.z-r.z},avatarRotation:Math.atan2(2*(h*c+l*u),1-2*(c*c+l*l)),fov:Bn(e.camera.fov)}}else t={cameraOffset:xo(e.cameraOffset),cameraTargetOffset:xo(e.cameraTargetOffset),avatarRotation:Bn(e.avatarRotation),avatarHeight:Bn(e.avatarHeight)>=.2&&e.avatarHeight<=10?e.avatarHeight:void 0,fov:Bn(e.fov)};const i={x:t.cameraOffset.x-t.cameraTargetOffset.x,y:t.cameraOffset.y-t.cameraTargetOffset.y,z:t.cameraOffset.z-t.cameraTargetOffset.z},s=Math.hypot(i.x,i.y,i.z);return!(s>.3&&s<100)||!(t.fov>5&&t.fov<150)||![t.cameraOffset,t.cameraTargetOffset].every(r=>Math.hypot(r.x,r.y,r.z)<=1e3)||!Number.isFinite(t.avatarRotation)?null:t}function bT(n,e){const t=e.avatarHeight,i=t/Ot.referenceHeight,s={x:e.at.x,y:e.at.y||0,z:e.at.z},r=Bn(e.facing,0),o=ET(n),a=Pg({yaw:r,scale:i});if(!o){const _=Math.cos(St.pitch)*a.distance;return{position:{x:s.x+Math.sin(r)*_,y:s.y+a.look.y-Math.sin(St.pitch)*a.distance,z:s.z+Math.cos(r)*_},target:{x:s.x,y:s.y+a.look.y,z:s.z},fov:St.fov,avatarRotation:r,scale:i,camera:a}}const l=t/(o.avatarHeight??Ot.referenceHeight),c=o.cameraOffset.x-o.cameraTargetOffset.x,u=o.cameraOffset.z-o.cameraTargetOffset.z,h=o.cameraOffset.y-o.cameraTargetOffset.y,d=Math.hypot(c,u)>1e-6?Math.atan2(c,u):o.avatarRotation,f=r-d,A=Math.sin(f),g=Math.cos(f),m=_=>({x:(_.x*g+_.z*A)*l,y:_.y*l,z:(_.z*g-_.x*A)*l}),p=m(o.cameraOffset),E=m(o.cameraTargetOffset),v=Math.hypot(c,h,u)*l;return a.distance=v,a.look=E,a.pitch=a.targetPitch=-Math.asin(xT(h*l/v,-1,1)),a.fov=o.fov,a.fovBlend=1,{position:{x:s.x+p.x,y:s.y+p.y,z:s.z+p.z},target:{x:s.x+E.x,y:s.y+E.y,z:s.z+E.z},fov:o.fov,avatarRotation:Math.atan2(Math.sin(o.avatarRotation+f),Math.cos(o.avatarRotation+f)),scale:i,camera:a}}function yT(n,e){var s;const t=globalThis;if(!/[?&]check\b/.test(String(((s=t.location)==null?void 0:s.search)??"")))return;const i={begin:e,read(){const r=n();return r?{x:r.state.x,z:r.state.z,time:r.state.time,scale:r.scale,floor:r.state.floor,rest:{...r.rest}}:null}};t.__oncyberLocomotion=i}function MT(n,e,t={}){n.position.set(e.position.x,e.position.y,e.position.z),n.lookAt(e.target.x,e.target.y,e.target.z);const i=t.near===!1?n.near:e.near;(n.fov!==e.fov||n.near!==i)&&(n.fov=e.fov,n.near=i,n.updateProjectionMatrix())}const ST=n=>typeof Element<"u"&&n instanceof Element&&!!n.closest("input, textarea, select, [contenteditable]:not([contenteditable=false]), [role=textbox]");function wT(n){const{view:e,stick:t}=n;let i=n.camera;const s=()=>{var x;return((x=n.enabled)==null?void 0:x.call(n))!==!1},r=new Set,o=dT(),a={strafe:0,forward:0};let l=null,c=null,u=!1;const h=x=>{if(!s()||x.isComposing||ST(x.target)||x.metaKey||x.ctrlKey||x.altKey)return;const S=tA(x);un.jump.includes(S)&&(!x.repeat&&!r.has(S)&&o.queue(),r.add(S),x.preventDefault()),un.run.includes(S)&&r.add(S),hT.has(S)&&(r.add(S),x.preventDefault())},d=x=>r.delete(tA(x)),f=x=>{var S;!s()||x.button!==0||((S=n.acceptLook)==null?void 0:S.call(n,x))===!1||(l={id:x.pointerId,x:x.clientX,y:x.clientY})},A=x=>{!l||x.pointerId!==l.id||(s()&&mT(i,x.clientX-l.x,x.clientY-l.y),l.x=x.clientX,l.y=x.clientY)},g=x=>{(l==null?void 0:l.id)===x.pointerId&&(l=null)},m=x=>{if(x.ctrlKey||x.metaKey||(x.preventDefault(),!s()))return;const S=x.deltaMode===1?16:x.deltaMode===2?e.clientHeight:1;gT(i,x.deltaY*S)},p=x=>{if(x.pointerId!==c||!t)return;const S=t.getBoundingClientRect();Object.assign(a,fT(x.clientX-S.left-S.width/2,x.clientY-S.top-S.height/2)),x.preventDefault()},E=x=>{!s()||!t||(c=x.pointerId,t.setPointerCapture(x.pointerId),p(x))},v=x=>{x.pointerId===c&&(c=null,a.strafe=a.forward=0)},_=()=>{r.clear(),o.clear(),l=null,c=null,a.strafe=a.forward=0};return window.addEventListener("keydown",h),window.addEventListener("keyup",d),window.addEventListener("blur",_),e.addEventListener("pointerdown",f),window.addEventListener("pointermove",A),window.addEventListener("pointerup",g),window.addEventListener("pointercancel",g),e.addEventListener("wheel",m,{passive:!1}),t==null||t.addEventListener("pointerdown",E),t==null||t.addEventListener("pointermove",p),t==null||t.addEventListener("pointerup",v),t==null||t.addEventListener("pointercancel",v),{read(x){if(!s())return(r.size||l)&&_(),iA(i,x),{strafe:0,forward:0,yaw:i.yaw,running:!1,jump:!1};const S=uT(r,x),I=pT(typeof navigator<"u"&&navigator.getGamepads?[...navigator.getGamepads()].find(Boolean):null,x);I.jump&&!u&&o.queue(),u=I.jump;const L=S.strafe+a.strafe+I.strafe,y=S.forward+a.forward+I.forward;return _T(i,S.turn+I.lookYaw,I.lookPitch),iA(i,x,Math.abs(L)+Math.abs(y)>.01),{strafe:L,forward:y,yaw:i.yaw,running:S.running||I.running,jump:o.read(x)}},setStick(x,S){a.strafe=Number.isFinite(x)?x:0,a.forward=Number.isFinite(S)?S:0},setCamera(x){i=x},clear:_,dispose(){window.removeEventListener("keydown",h),window.removeEventListener("keyup",d),window.removeEventListener("blur",_),e.removeEventListener("pointerdown",f),window.removeEventListener("pointermove",A),window.removeEventListener("pointerup",g),window.removeEventListener("pointercancel",g),e.removeEventListener("wheel",m),t==null||t.removeEventListener("pointerdown",E),t==null||t.removeEventListener("pointermove",p),t==null||t.removeEventListener("pointerup",v),t==null||t.removeEventListener("pointercancel",v)}}}const Ze=n=>document.querySelector(n),Mt=PS();Mt.hello();const td=Ze("#stage"),yn=new CM({canvas:td,antialias:!0,powerPreference:"high-performance"});yn.setPixelRatio(Math.min(window.devicePixelRatio||1,2));yn.outputColorSpace=Bt;yn.toneMapping=dA;yn.toneMappingExposure=1.05;yn.shadowMap.enabled=!0;yn.shadowMap.type=hA;const zn=new M_;zn.fog=new Th(13626111,90,320);const kt=new hn(42,1,.1,900),Ah=()=>kt.aspect<1?58:42;function oa(){const n=window.innerWidth,e=window.innerHeight;yn.setSize(n,e,!1),kt.aspect=n/e,(Q==null?void 0:Q.camMode)!=="arrive"&&(kt.fov=Ah()),kt.updateProjectionMatrix(),Un&&yn.render(zn,kt)}window.addEventListener("resize",oa);const Is={rookie:{name:"Benny",blurb:"Just happy to be here. Loves a lob.",palette:Mr[2]},pro:{name:"Marta",blurb:"Steady from the baseline. Hates errors.",palette:Mr[1]},ace:{name:"Nova",blurb:"Hits it early, hits it hard.",palette:Mr[3]}},Lt={difficulty:"pro",games:2};function CT(){try{const n=JSON.parse(Mt.storage.get("settings")||"{}");Si[n.difficulty]&&(Lt.difficulty=n.difficulty),[1,2,3].includes(n.games)&&(Lt.games=n.games)}catch{}Ug(),Ue.muted=Mt.storage.get("muted")==="1"}const So=new URLSearchParams(location.search);function Ug(){Si[So.get("difficulty")]&&(Lt.difficulty=So.get("difficulty")),[1,2,3].includes(Number(So.get("games")))&&(Lt.games=Number(So.get("games")))}Ug();const Ue=IM();function ms(n,e){Ze("#boot-fill").style.width=`${Math.round(n*100)}%`,e&&(Ze("#boot-text").textContent=e),Mt.progress(n)}ms(.1);let Un,Rt,jt,ni;const Q={screen:"boot",engine:null,attract:!0,identity:{name:"You",pfp:""},shake:0,cam:{pos:new w(0,12,34),look:new w(0,0,0)},camMode:"orbit",camT:0,paused:!1,hintPoints:0,rally:0,matchEndAt:0,hops:[0,0],lastCharge:!1,chargeFull:!1,orbit:0,intro:0},wo={x:2.4,z:Ne.halfLength+1.2},xu={x:Ne.doublesHalfWidth+2.4,zMin:.7,zMax:Ne.halfLength+2.6},mh=1.75,IT=0,Tt={came:!1,walker:cT(wo,{scale:mh/1.8,constrain(n){n.x=Math.max(-7.885,Math.min(xu.x,n.x)),n.z=Math.max(xu.zMin,Math.min(xu.zMax,n.z))}}),camera:Pg({scale:mh/1.8}),faceYaw:0,lift:0,sink:0,rising:!1},Nl=.42,TT=.7;oa();function RT(){Un=WS(zn),ms(.5,"Seating the crowd…"),Rt=MS(zn);const n=al(Mr[0]),e=al(Is[Lt.difficulty].palette);zn.add(n.root,e.root),jt=[n,e],ni=al({shirt:1911631,shorts:1911631,band:16777215,racket:16777215,hair:9145227,skin:15909787,shoe:1118481,sole:1118481}),ni.racket.visible=!1,ni.root.position.set(Un.umpireSeat.x,Un.umpireSeat.y-.66,0),ni.root.rotation.y=-Math.PI/2,zn.add(ni.root),ms(.75,"Stringing rackets…")}function BT(n){const e=al(Is[n].palette);zn.remove(jt[1].root),jt[1]=e,zn.add(e.root)}const LT=["boot","title","arrive","party","setup","howto","hud","vs","pause","results"];function Wn(...n){for(const e of LT)Ze(`#${e}`).classList.toggle("show",n.includes(e));document.body.classList.toggle("playing",n.includes("hud")&&!n.includes("pause"))}const ki={title:{el:"#main-menu",index:0},pause:{el:"#pause-menu",index:0},results:{el:"#results-menu",index:0}};function ea(n,e=ki[n].index){const t=[...document.querySelectorAll(`${ki[n].el} .pill`)];ki[n].index=(e+t.length)%t.length,t.forEach((i,s)=>i.classList.toggle("focus",s===ki[n].index))}function Fg(){Q.screen="title",Q.paused=!1,Wn("title"),ea("title",0),rd(),Cs(Ue,"title"),Vh(Ue,.5)}function nd(n){const e=bT(n,{at:wo,facing:IT,avatarHeight:mh});Tt.came=!0,Tt.camera=e.camera,ta.setCamera(e.camera),ta.clear(),Tt.walker.place({...wo,y:0,rotation:e.avatarRotation}),Tt.faceYaw=e.avatarRotation,Tt.lift=0,Q.attract=!1,Q.paused=!1,Q.screen="arrive",Q.engine=Jh({difficulty:Lt.difficulty,games:Lt.games,seed:Math.random()*1e9|0});const t=Q.engine.athletes[0];t.x=wo.x,t.z=wo.z,jt[0].yaw=Tt.faceYaw,jt[0].racket.visible=!1,Tt.sink=n?Nl:0,Tt.rising=!n||Mt.entered,Q.camMode="arrive",oa(),Ng(),Q.cam.pos.copy(xi),Q.cam.look.copy(hs),ra(Rt),Wn("arrive"),Cs(Ue,"title"),Vh(Ue,.3)}function gh(){Tt.came?nd(null):Fg()}function DT(){const n=Tt.sink/Nl;return Nl*n*n*(3-2*n)}function Ng(){const n=Q.engine.athletes[0],e=vT(Tt.camera,n,window.innerWidth);MT(kt,e,{near:!1}),xi.copy(e.position),hs.copy(e.target)}function PT(n,e){const t=Q.engine.athletes[0];Tt.rising&&Tt.sink>0&&(Tt.sink=Math.max(0,Tt.sink-Nl/TT*e));const i=Xr.touch.active;ta.setStick(i?n.x:0,i?-n.y:0);const s=ta.read(e),r=Tt.walker.advance(e,s),o=Tt.walker.velocity(s.yaw);t.x=r.x,t.z=r.z,t.vx=o.x,t.vz=o.z,t.stateTime+=e,Tt.lift=r.y,Tt.faceYaw=r.rotation,jt[0].yaw=r.rotation}const ta=wT({view:td,camera:Tt.camera,enabled:()=>(Q==null?void 0:Q.screen)==="arrive"&&Tt.sink<=0&&Xr.enabled,acceptLook:n=>n.pointerType!=="touch"||n.clientX>=window.innerWidth*.5});yT(()=>(Q==null?void 0:Q.screen)==="arrive"?Tt.walker:null,()=>{Q.screen!=="arrive"&&nd(null)});function id(){const n=`${Q.identity.name||"You"} (you)`;return Mt.selfId&&Mt.roster.length?[{id:Mt.selfId,name:n},...Mt.roster]:[{id:"self",name:n},...Mt.party.members]}function Og(){Q.screen="party",Wn("party");const n=id();Ze("#party-title").textContent=`Party of ${n.length}`,Ze("#party-names").textContent=n.map(i=>i.name).join(" · ");const e=bm(n.length);Ze("#party-formats").replaceChildren(...e.map((i,s)=>{const r=document.createElement("button");r.className=`pill${s===0?" big":""}`,r.dataset.format=i.id;const o=document.createElement("span");o.textContent=i.label;const a=document.createElement("small");return a.textContent=i.blurb,r.append(o,a),r})),Ze("#party-lineup").hidden=!0,Ze("#party-note").hidden=!0,Q.partyFormat=null}function kg(n){if(n==="cpu")return Qg();const e=FS(n,id(),Mt.party.id);if(!e)return;Q.partyFormat=n;const t=Ze("#party-lineup");t.replaceChildren(...e.rounds.flatMap(i=>{const s=document.createElement("h3");return s.textContent=i.name,[s,...i.matches.map(([r,o])=>{const a=document.createElement("p"),l=document.createElement("i");return l.textContent="v",a.append(Kf(r,e.rounds),l,Kf(o,e.rounds)),a})]})),t.hidden=!1,Ze("#party-note").hidden=!1,document.querySelectorAll("#party-formats .pill").forEach(i=>i.classList.toggle("focus",i.dataset.format===n))}function Qg(){Q.screen="setup",Wn("setup"),Q.setupField=0,sd()}let Hg="title";function UT(n){Hg=n,Q.screen="howto",Wn("howto",n==="pause"?"hud":"")}function sd(){for(const e of document.querySelectorAll("#opt-difficulty button"))e.setAttribute("aria-pressed",String(e.dataset.value===Lt.difficulty));for(const e of document.querySelectorAll("#opt-games button"))e.setAttribute("aria-pressed",String(Number(e.dataset.value)===Lt.games));const n=Is[Lt.difficulty];Ze("#foe-name").textContent=`${n.name} · ${Si[Lt.difficulty].label}`,Ze("#foe-blurb").textContent=n.blurb,Ze("#foe-face").style.backgroundImage=`url(${ih(n.palette)})`,document.querySelectorAll("#setup .field").forEach((e,t)=>e.classList.toggle("focus",t===Q.setupField)),Mt.storage.set("settings",JSON.stringify(Lt))}function rd(){Q.attract=!0,jt&&(jt[0].racket.visible=!0),Q.engine=Jh({difficulty:"pro",games:99,seed:Math.random()*1e9|0,autoHuman:!0}),gm(Q.engine),Q.camMode="orbit",oa(),ra(Rt)}function pl(){BT(Lt.difficulty),Q.attract=!1,jt[0].racket.visible=!0,Q.engine=Jh({difficulty:Lt.difficulty,games:Lt.games,seed:Math.random()*1e9|0}),gm(Q.engine),Q.engine.phase="intro",Q.rally=0,Q.hintPoints=0,Q.matchEndAt=0,ra(Rt),ym(Xr);const n=Is[Lt.difficulty],e=Q.identity;Ze("#sb-name-0").textContent=e.name,Ze("#sb-name-1").textContent=n.name;const t=e.pfp||ih(Mr[0]);for(const i of[Ze("#sb-face-0"),Ze("#vs-face-0")])i.style.backgroundImage=`url("${t}")`;for(const i of[Ze("#sb-face-1"),Ze("#vs-face-1")])i.style.backgroundImage=`url(${ih(n.palette)})`;Ze("#vs-name-0").textContent=e.name,Ze("#vs-name-1").textContent=n.name,Ze("#vs-tag").textContent=Si[Lt.difficulty].label,_h(!1),Q.screen="vs",Wn("vs"),Cs(Ue,"soft"),en(Ue,"stamp"),Q.camMode="intro",oa(),Q.camT=0,setTimeout(()=>{Q.screen==="vs"&&(Wn("hud"),Q.screen="intro",vi("READY?","yellow"),Ar(Ue,"ready"),setTimeout(()=>{Q.screen==="intro"&&(vi("PLAY!","green"),Ar(Ue,"go"),Cs(Ue,"match"),Vh(Ue,.35),ur(Un,.8),Q.screen="playing",Q.engine.phase="setup",Q.engine.phaseTime=0,Q.camMode="play")},1100))},1900)}function od(){Q.screen==="playing"&&(Q.paused=!0,Q.screen="pause",Po(Ue),Wn("hud","pause"),ea("pause",0),en(Ue,"back"))}function Gg(){Q.paused=!1,Q.screen="playing",Wn("hud"),ym(Xr),en(Ue,"ok")}function zg(){ws(Ue),TM(Ue,!Ue.muted),Mt.storage.set("muted",Ue.muted?"1":"0"),Vg(),en(Ue,"ok")}function Vg(){Ze("#sound-label").textContent=Ue.muted?"Off":"On";for(const n of document.querySelectorAll(".sound-label"))n.textContent=Ue.muted?"Off":"On"}Vg();function us(n){switch(ws(Ue),n){case"play":en(Ue,"ok"),Mt.party?Og():Qg();break;case"howto":en(Ue,"ok"),UT(Q.screen==="pause"?"pause":"title");break;case"sound":zg();break;case"back":en(Ue,"back"),Q.screen==="howto"&&Hg==="pause"?(Q.screen="pause",Wn("hud","pause")):gh();break;case"start":en(Ue,"ok"),pl();break;case"resume":Gg();break;case"restart":en(Ue,"ok"),pl();break;case"quit":case"menu":en(Ue,"back"),gh();break;case"lobby":Mt.exit();break;case"rematch":en(Ue,"ok"),pl();break}}document.addEventListener("click",n=>{const e=n.target.closest("[data-action]");e&&us(e.dataset.action);const t=n.target.closest("#party-formats [data-format]");t&&(ws(Ue),en(Ue,"ok"),kg(t.dataset.format));const i=n.target.closest(".choice button");i&&(ws(Ue),en(Ue,"move"),i.parentElement.id==="opt-difficulty"?Lt.difficulty=i.dataset.value:Lt.games=Number(i.dataset.value),sd())});Ze("#pause-btn").addEventListener("click",()=>{ws(Ue),od()});Ze("#lobby").hidden=!Mt.embedded;Ze("#lobby").addEventListener("click",()=>Mt.exit());document.addEventListener("visibilitychange",()=>{document.hidden&&!ad&&od()});function FT(n,e){e==="up"||e==="left"?ea(n,ki[n].index-1):ea(n,ki[n].index+1),en(Ue,"move")}function NT(n){var t;(t=[...document.querySelectorAll(`${ki[n].el} .pill`)][ki[n].index])==null||t.click()}function OT(n){for(const e of n){e.type==="mute"&&zg(),(e.type==="confirm"||e.type==="shot"||e.type==="nav")&&ws(Ue);const t=Q.screen;if(t==="title"||t==="pause"||t==="results")e.type==="nav"&&FT(t,e.dir),e.type==="confirm"&&NT(t),t==="pause"&&(e.type==="pause"||e.type==="back")&&Gg();else if(t==="setup"){if(e.type==="nav"){const i=["difficulty","games"];if(e.dir==="up"||e.dir==="down")Q.setupField=(Q.setupField+(e.dir==="down"?1:-1)+3)%3;else if(Q.setupField<2){const s=i[Q.setupField],r=s==="difficulty"?["rookie","pro","ace"]:[1,2,3],o=r.indexOf(Lt[s]);Lt[s]=r[Math.max(0,Math.min(2,o+(e.dir==="right"?1:-1)))]}en(Ue,"move"),sd(),document.querySelector("#setup .go").classList.toggle("focus",Q.setupField===2)}e.type==="confirm"&&us("start"),e.type==="back"&&us("back")}else t==="arrive"?(e.type==="confirm"&&e.code!=="Space"&&!e.pad||e.type==="pause"&&e.pad)&&us("play"):t==="party"?e.type==="back"&&us("back"):t==="howto"?(e.type==="confirm"||e.type==="back")&&us("back"):t==="playing"&&e.type==="pause"&&od()}}function _h(n=!0,e=null){const t=Q.engine.match,i=Xh(t);for(const s of[0,1]){Ze(`#sb-games-${s}`).textContent=t.games[s];let r=["0","15","30","40"][Math.min(3,t.points[s])];t.points[0]>=3&&t.points[1]>=3&&(r=t.points[s]>t.points[1-s]?"AD":"40"),Ze(`#sb-points-${s}`).textContent=r,document.querySelector(`.sb-row[data-who="${s}"]`).classList.toggle("serving",t.server===s)}if(n&&e!==null){const s=Ze(`#sb-points-${e}`);s.classList.remove("bump"),s.offsetWidth,s.classList.add("bump")}return i}let sA=0;function vi(n,e="",t=""){const i=Ze("#callout");i.className="callout",i.offsetWidth,i.innerHTML=`${n}${t?`<small>${t}</small>`:""}`,i.className=`callout show ${e}`,clearTimeout(sA),sA=setTimeout(()=>i.className="callout",1400),en(Ue,"stamp")}let rA=0;function Eu(n,e=1400){const t=Ze("#banner");t.textContent=n,t.classList.add("show"),clearTimeout(rA),rA=setTimeout(()=>t.classList.remove("show"),e)}const wr=new w;function oA(n,e){const t=Ze("#grade"),i={perfect:"PERFECT!",great:"GREAT!",nice:"NICE",miss:"MISS",weak:"OOPS"}[n];i&&(wr.copy(e).project(kt),t.className="grade",t.offsetWidth,t.textContent=i,t.style.left=`${(wr.x*.5+.5)*window.innerWidth}px`,t.style.top=`${(-wr.y*.5+.5)*window.innerHeight}px`,t.className=`grade show ${n}`)}function kT(n=.6){const e=Ze("#flash");e.style.transition="none",e.style.opacity=String(n),requestAnimationFrame(()=>{e.style.transition="opacity 0.35s ease-out",e.style.opacity="0"})}function il(n){const e=Ze("#hint");e.innerHTML!==n&&(e.innerHTML=n)}function bu(n){const e=Ze("#rally");e.classList.toggle("show",n>=3),Ze("#rally-count").textContent=n,n>=3&&(e.classList.add("pop"),setTimeout(()=>e.classList.remove("pop"),120))}const QT={out:["OUT!","red"],fault:["FAULT","red"],"fault-net":["NET","red"],net:["NET!","red"],ace:["ACE!","yellow"],let:["LET","blue"],"volley-serve":["FOOT FAULT","red"]};function aA(n){const e=Q.engine;for(const t of n)switch(t.type){case"setup":ra(Rt),Q.rally=0,Q.attract||(bu(0),_h(!1),t.second&&Eu("Second serve"));break;case"toss":DM(Ue);break;case"retoss":!Q.attract&&t.who===0&&Eu("Hit it near the top of the toss!",1800);break;case"charge":!Q.attract&&!t.change&&FM(Ue,t.shot);break;case"whiff":Po(Ue),Pf(Ue,.8),Q.attract||oA("miss",wr.copy(jt[0].root.position).setY(2.3));break;case"hit":{Po(Ue);const i=Vn[t.shot]||Vn.topspin,s=t.grade==="perfect";RM(Ue,t.power,t.grade,t.shot),Pf(Ue,.5+t.power*.5);const r=new w(t.x,t.y,t.z);SS(Rt,r,i.color,s),TS(Rt,i.color,s?1.6:.6+t.power*.5,s?.16:.07+t.power*.05),s?(Q.shake=Math.max(Q.shake,.35),kT(.55),ur(Un,.3)):t.power>.8&&(Q.shake=Math.max(Q.shake,.12)),!Q.attract&&(t.who===0||s)&&oA(t.grade,wr.copy(jt[t.who].root.position).setY(2.4)),Q.hops[1-t.who]=2.4,jt[t.who].contactHeight=t.y,t.serve||(Q.rally+=1,Q.attract||bu(Q.rally));break}case"bounce":{BM(Ue,t.speed),wS(Rt,t.x,t.z,Math.min(1.2,t.speed/18),t.out?16757691:14083327),CS(Rt,t.x,t.z,t.out),t.index===1&&Ll(Rt,new w(t.x,.02,t.z),t.out?16731486:16777215,.9,.3,!0);break}case"net":LM(Ue),!Q.attract&&t.cord&&Eu("Net cord!");break;case"verdict":{if(Po(Ue),Q.attract)break;const i=QT[t.reason];t.reason==="fault"&&t.faults>0?vi("DOUBLE FAULT","red"):i?vi(i[0],i[1]):t.reason==="winner"&&vi(t.winner===0?"WINNER!":"POINT",t.winner===0?"green":"blue"),["out","fault","fault-net","net"].includes(t.reason)&&Ar(Ue,"out");break}case"point":{if(Q.attract){ur(Un,.6);break}const i=_h(!0,t.winner),s=t.winner===0;if(Ar(Ue,s?"point":"lost"),s?Uf(Ue,.6+Math.min(1,Q.rally/10)):UM(Ue),ur(Un,s?1:.4),Q.hintPoints+=1,t.match)break;setTimeout(()=>{if(Q.screen==="playing")if(t.game){vi("GAME!",t.gameWinner===0?"red":"blue",`${t.games[0]} – ${t.games[1]}`),Ar(Ue,"game");const r=Ze(`#sb-games-${t.gameWinner}`);r.classList.remove("bump"),r.offsetWidth,r.classList.add("bump"),ur(Un,1.2)}else if(i.kind==="advantage")vi("ADVANTAGE",i.leader===0?"red":"blue",i.leader===0?Q.identity.name:Is[Lt.difficulty].name);else{const r=e.match,o=[0,1].some(a=>r.games[a]===r.gamesToWin-1&&r.points[a]>=3&&r.points[a]>r.points[1-a]);vi(i.text,"",o?"MATCH POINT":"")}},700);break}case"match":{if(Q.attract){rd();break}const i=t.winner===0;setTimeout(()=>{vi(i?"GAME, SET & MATCH!":"MATCH OVER",i?"yellow":"blue"),Ar(Ue,i?"win":"lose"),i&&(Uf(Ue,1.6),IS(Rt,new w(jt[0].root.position.x,3,jt[0].root.position.z))),ur(Un,1.4),Q.camMode="winner",Q.camT=0},900),Q.matchEndAt=performance.now()+3600,bu(0);break}}}function HT(){const e=Q.engine.match,t=e.winner===0;Q.screen="results",Wn("results"),ea("results",0),Cs(Ue,"title"),Ze("#result-title").textContent=t?"You win!":`${Is[Lt.difficulty].name} wins!`,Ze("#result-title").style.color=t?"var(--red)":"var(--blue)",Ze("#result-score").textContent=`${e.games[0]} – ${e.games[1]}`;const i=e.stats,s=[["Perfect shots",i[0].perfects,i[1].perfects],["Aces",i[0].aces,i[1].aces],["Winners",i[0].winners,i[1].winners],["Faults",i[0].faults,i[1].faults]];Ze("#stats").innerHTML=`<span class="h"></span><span class="h v">${Q.identity.name.slice(0,8)}</span><span class="h v">${Is[Lt.difficulty].name}</span>`+s.map(([r,o,a])=>`<span>${r}</span><span class="v">${o}</span><span class="v">${a}</span>`).join("")+`<span>Longest rally</span><span class="v" style="grid-column: span 2">${e.longestRally} shots</span>`}const Xr=NS(td,document.querySelector(".touch-pad"));var cA;(cA=window.matchMedia)!=null&&cA.call(window,"(pointer: coarse)").matches&&document.body.classList.add("is-touch");const Wg=new Pv,xi=new w,hs=new w,cr={x:0,z:0},GT=()=>.25,ad=new URLSearchParams(location.search).has("autoplay"),sl={pressed:-1};let qg=Number(new URLSearchParams(location.search).get("slow"))||1;function zT(){const n=Q.engine,e=n.athletes[0];let t=null,i={x:0,z:0};const s=!1;if(n.phase==="serve"&&n.match.server===0&&n.phaseTime>.6&&(t="flat"),n.phase==="toss"&&n.match.server===0&&n.ball.v.y<.3&&n.ball.v.y>-.4&&(t="flat"),n.phase==="rally"&&n.rally.lastHitter===1&&n.ball.v.z>0&&(sl.pressed!==n.hitCount&&(e.z-n.ball.p.z)/Math.max(1,n.ball.v.z)<.85&&(t=["flat","topspin","slice","lob","drop"][n.hitCount%5],sl.pressed=n.hitCount,sl.aim={x:Math.random()*2-1,y:Math.random()-.3}),n.plan)){const r=n.plan.standX-e.x,o=n.plan.standZ-e.z,a=Math.hypot(r,o);a>.3&&(i={x:r/a,z:o/a})}return{move:i,aim:sl.aim||{x:0,y:0},press:t,release:s}}function VT(n){if(ad)return zT();const e={x:n.x,z:-n.y};let t=null,i=!1;for(const s of n.events)s.type==="shot"&&(t=s.shot),s.type==="release"&&(i=!0);return{move:e,aim:{x:n.x,y:n.y},press:t,release:i}}function WT(n){const e=Q.engine,[t]=e.athletes,i=e.ball;if(Q.camT+=n,Q.camMode==="arrive"){Ng(),Q.cam.pos.copy(xi),Q.cam.look.copy(hs);return}if(kt.fov!==Ah()&&(kt.fov=Ah(),kt.updateProjectionMatrix()),Q.camMode==="orbit")Q.orbit+=n*.08,xi.set(Math.sin(Q.orbit)*27,9.5+Math.sin(Q.orbit*.7)*2,Math.cos(Q.orbit)*27),hs.set(0,.8,0);else if(Q.camMode==="winner"){const o=e.athletes[e.match.winner??0],a=Math.min(1,Q.camT/1.4),l=Math.sin(Q.camT*.35)*1.4;xi.set(o.x+1+l,1.7+(1-a)*2,o.z-o.side*(5.4+(1-a)*3)),hs.set(o.x,1.35,o.z)}else{const o=t.x,a=Math.max(4,t.z),l=Math.max(0,Math.min(1,(1/kt.aspect-.8)/1.2));if(xi.set(o*(.55-l*.25),4.9+l*3.2,a+8.4+l*5.5),hs.set(o*.25+(i.held?0:i.p.x*.12),.3,-3.5),Q.camMode==="intro"){const c=Math.min(1,Q.camT/2.6),u=1-Math.pow(1-c,3),h=new w(-18,16,30);xi.lerpVectors(h,xi,u),c>=1&&(Q.camMode="play")}}const s=Q.camMode==="play"?5:Q.camMode==="winner"?3:2,r=1-Math.exp(-s*n);if(Q.cam.pos.lerp(xi,r),Q.cam.look.lerp(hs,r),kt.position.copy(Q.cam.pos),Q.shake>0){const o=Q.shake*Q.shake;kt.position.x+=(Math.random()-.5)*o,kt.position.y+=(Math.random()-.5)*o,Q.shake=Math.max(0,Q.shake-n*1.6)}kt.lookAt(Q.cam.look)}const lA={aura:0};function qT(n){const e=Q.engine,t=e.athletes[0],i=jt[0];if(Q.attract||!t.pending){Rt.aim.visible=!1,Q.chargeFull=!1;return}const s=Vn[t.pending.shot],r=YM(i,wr);lA.aura+=n;const o=t.charge>=1?3:1;for(let c=0;c<o;c++){const u=lA.aura*14+c*2.1,h=.45-t.charge*.25;jl(Rt,{x:r.x+Math.cos(u)*h,y:r.y+Math.sin(u*.7)*h*.6,z:r.z+Math.sin(u)*h,vy:.6,life:.35,size:.12+t.charge*.1,color:c%2?16777215:s.color,shape:2,drag:1})}NM(Ue,t.charge),t.charge>=1&&!Q.chargeFull&&(Q.chargeFull=!0,Ll(Rt,r.clone(),s.color,1.2,.25,!1));const a=pm(t,t.pending.shot,e.humanAim||{x:0,y:0},.2+t.charge*.8,1,GT);cr.x+=(a.x-cr.x)*Math.min(1,n*12),cr.z+=(a.z-cr.z)*Math.min(1,n*12),Rt.aim.visible=!0,Rt.aim.position.set(cr.x,.014,cr.z);const l=.9+Math.sin(performance.now()*.012)*.06;Rt.aim.scale.set(l,l,1),Rt.aim.material.color.setHex(s.color)}function XT(){var s;const n=Q.engine,e=n.landing,t=n.ball,i=!Q.attract&&n.phase==="rally"&&e&&t.bounces===0&&n.rally.lastHitter===1&&t.v.z>0;if(Rt.marker.visible=!!i,i){Rt.marker.position.set(e.x,.012,e.z);const r=Math.max(0,e.t-n.time),o=.5+Math.min(1.2,r*1.1);Rt.marker.scale.set(o,o,1),Rt.marker.material.opacity=.9,Rt.marker.material.color.setHex(((s=Vn[t.shot])==null?void 0:s.color)??16769357)}}function YT(n){const e=Q.engine,t=e.ball;for(let i=0;i<2;i++){const s=e.athletes[i],r=jt[i],o=(t.p.x-s.x)*s.right;let a=s;if(i===1||Q.attract){const h=i===1?e.brain:e.autoBrain,d=h==null?void 0:h.plan,f=t.v.z*s.dir<0&&e.phase==="rally"&&!t.held;if(d&&f&&!s.swing){const A=Math.abs(t.p.z-s.z);A<12&&(a={...s,state:"charge",charge:Math.min(1,(12-A)/10),stateTime:Math.max(.2,(12-A)/10)})}}const l=e.plan&&i===0?e.plan.hand:o>=0?1:-1,c=Q.hops[i];Q.hops[i]=0;const u=(e.phase==="between"&&e.pendingVerdict===null,null);XM(r,a,{dt:n,yawBias:Math.max(-.35,Math.min(.35,(t.p.x-s.x)*.04))*(s.side>0,-1),swingSide:l,contactHeight:r.contactHeight||1,hopNow:c,headYaw:0,mood:u,...i===0&&Q.camMode==="arrive"?{faceYaw:Tt.faceYaw,sink:DT(),lift:Tt.lift}:{}}),r.rig&&rT(r,n)}if(ni){const i=t.p.z;ni.head.rotation.y=Math.max(-1,Math.min(1,i*.08)),ni.time+=n,ni.body.position.y=Math.sin(ni.time*2)*.01}}const Al=document.getElementById("serveGauge"),jT=Al.querySelector(".sg-fill"),yu=new w,Zn={shown:!1,hold:0,level:0};function JT(n){const e=Q.engine,t=e.athletes[0];let i=!1;if(!Q.attract&&Q.screen==="playing"&&e.match.server===0&&(e.phase==="toss"?(i=!0,Zn.hold=0,Zn.level=jh(e.time-e.tossAt)):e.phase==="rally"&&e.hitCount===1&&(Zn.hold+=n,i=Zn.hold<.6,Zn.level=e.serveGauge??Zn.level)),i!==Zn.shown&&(Al.classList.toggle("on",i),Zn.shown=i),!i)return;yu.set(t.x,2.55,t.z).project(kt);const s=(yu.x*.5+.5)*window.innerWidth,r=(-yu.y*.5+.5)*window.innerHeight;Al.style.transform=`translate(${s.toFixed(1)}px, ${r.toFixed(1)}px)`,jT.style.transform=`scaleX(${Zn.level.toFixed(3)})`,Al.classList.toggle("max",Zn.level>=.86)}function KT(){if(Q.attract||Q.screen!=="playing")return;const n=Q.engine;n.phase==="serve"||n.phase==="toss"?n.match.server===0?il(n.phase==="serve"?'<span>Hold <span class="key">J</span>to toss</span><span><span class="key">A</span><span class="key">D</span>Move</span>':'<span>Let go when the gauge is full!</span><span><span class="key">←</span><span class="key">→</span>Aim</span>'):il(""):n.phase==="rally"&&Q.hintPoints<4?il('<span><span class="key">J</span>Hit</span><span><span class="key">K</span>Topspin</span><span><span class="key">H</span>Cut</span><span><span class="key">U</span>Lob</span><span><span class="key">H</span><span class="key">K</span>Drop</span><span>Press early to charge · hold a direction to aim</span>'):il("")}function Xg(){requestAnimationFrame(Xg);let n=Math.min(.05,Wg.getDelta())*qg;const e=OS(Xr);OT(e.events);const t=Q.engine;if(!t||!Un)return;const i=Q.screen==="playing"||Q.attract;if(Q.screen==="playing"&&!Q.paused){const s=Yc(t,VT(e),n);aA(s)}else if(Q.attract)aA(Yc(t,{move:{x:0,z:0},aim:{x:0,y:0},press:null},n));else if(Q.screen==="arrive")PT(e,n);else if(Q.screen==="intro"||Q.screen==="vs")for(const s of t.athletes)s.stateTime+=n;Q.screen==="pause"&&(n=1e-4),Q.matchEndAt&&performance.now()>Q.matchEndAt&&Q.screen==="playing"&&(Q.matchEndAt=0,HT()),Q.screen==="results"&&Yc(t,{move:{x:0,z:0},aim:{x:0,y:0},press:null},n),(t.freeze<=0||!i)&&YT(n),qT(n),XT(),JT(n),KT(),WT(n),qS(Un,n,t.ball.p),(t.phase==="toss"||t.phase==="serve"||t.phase==="setup")&&ra(Rt),RS(Rt,n,kt,t.ball.p,t.ballVisible&&t.phase!=="idle"&&t.phase!=="intro"),yn.render(zn,kt)}async function ZT(){try{await(document.fonts?Promise.race([document.fonts.load('900 40px "Arial Black"'),new Promise(i=>setTimeout(i,1500))]):null),ms(.25,"Painting the lines…"),RT(),rd(),yn.compile(zn,kt),ms(.9,"Warming up…");const e=await Mt.resolveIdentity();CT(),Q.identity={name:e.name||"You",pfp:e.pfp||""};const t=e.avatarUrl||So.get("vrm");if(t){ms(.93,"Suiting up…");try{const i=await Promise.race([tT(t,yn),new Promise((s,r)=>setTimeout(()=>r(new Error("avatar timeout")),2e4))]);sT(jt[0],i),yn.compile(zn,kt)}catch(i){console.warn("ACE: avatar unavailable, using the default player",i)}}Wg.getDelta(),requestAnimationFrame(Xg),await new Promise(i=>requestAnimationFrame(()=>requestAnimationFrame(i))),ms(1,"Ready!"),Mt.ready(),Yg=!0,setTimeout(()=>{Q.screen==="boot"&&(ad?pl():Ol!==void 0?jg(Ol):Fg())},250)}catch(n){console.error(n),Mt.fail(n&&n.message?n.message:"boot failed"),Ze("#boot-text").textContent="Something went wrong. Please reload."}}let Yg=!1,Ol;function jg(n){Ol=void 0,nd(n),requestAnimationFrame(()=>requestAnimationFrame(()=>Mt.arrivalReady()))}Mt.on("entered",()=>Tt.rising=!0);Mt.on("party",()=>{if(Q.screen!=="party")return;if(!Mt.party)return gh();const n=Q.partyFormat;Og(),n&&bm(id().length).some(e=>e.id===n)&&kg(n)});Mt.on("arrival",n=>{Yg?jg(n):Ol=n});Mt.on("dispose",()=>{QM(Ue),Xr.dispose(),ta.dispose(),yn.dispose(),Mt.dispose()});const Jg=()=>{ws(Ue),(Q.screen==="title"||Q.screen==="results")&&Cs(Ue,"title")};window.addEventListener("pointerdown",Jg,{once:!0});window.addEventListener("keydown",Jg,{once:!0});window.__ace={state:Q,get engine(){return Q.engine},action:us,set timeScale(n){qg=n}};ZT();
