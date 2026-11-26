// Metres. The lighting baker and the live renderer use this same set description.
export const BAY = 4.6, BAYS = 7, LENGTH = BAY * BAYS, WIDTH = 3.36, HEIGHT = 2.72;
const X = WIDTH / 2, Y = HEIGHT;
const plus=(a,b)=>a.map((v,i)=>v+b[i]);
const times=(a,k)=>a.map(v=>v*k);
const diff=(a,b)=>plus(a,times(b,-1));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const unit=a=>times(a,1/(Math.hypot(...a)||1));
const axis=(i,v)=>[0,1,2].map(j=>i===j?v:0);
const albedo={carpet:[.12,.095,.072],padded:[.38,.29,.20],wall:[.39,.29,.205],ceiling:[.63,.57,.47],wood:[.16,.085,.044],door:[.12,.073,.044],trim:[.066,.038,.024],flute:[.098,.054,.027],brass:[.29,.19,.087],antique:[.16,.105,.059],stone:[.10,.077,.060],opal:[.75,.72,.64],print:[.32,.27,.21],paper:[.54,.49,.37]};
const detail={small:true,shadow:false};

export function buildScene(){
  const charts=[],occluders=[],lights=[],faces=[],curves=[];
  function face(c,u,v,mat,options={}){
    const normal=unit(cross(u,v)),origin=diff(diff(c,times(u,.5)),times(v,.5));
    let chart=-1;
    if(!options.small&&!options.unlit){
      chart=charts.length;
      const density=options.density??(['wall','padded','ceiling','carpet'].includes(mat)?58:22);
      charts.push({id:chart,origin,u,v,normal,albedo:albedo[mat]??albedo.wood,
        w:Math.max(2,Math.ceil(Math.hypot(...u)*density))+4,h:Math.max(2,Math.ceil(Math.hypot(...v)*density))+4});
    }
    faces.push({origin,u,v,normal,mat,chart,stretch:!!options.stretch,group:options.group||''});
  }
  function toward(c,u,v,normal,mat,options){
    if(dot(cross(u,v),normal)<0)u=times(u,-1);
    face(c,u,v,mat,options);
  }
  function box(x,y,z,w,h,d,mat,o={}){
    const c=[x,y,z],s=[w,h,d];
    if(o.shadow!==false)occluders.push({min:c.map((q,i)=>q-s[i]/2),max:c.map((q,i)=>q+s[i]/2),group:o.group||''});
    const sides=[
      [[x+w/2,y,z],[0,0,-d],[0,h,0]], [[x-w/2,y,z],[0,0,d],[0,h,0]],
      [[x,y+h/2,z],[w,0,0],[0,0,-d]], [[x,y-h/2,z],[w,0,0],[0,0,d]],
      [[x,y,z+d/2],[w,0,0],[0,h,0]], [[x,y,z-d/2],[-w,0,0],[0,h,0]]
    ];
    for(const i of o.sides??[0,1,2,3,4,5])face(...sides[i],mat,o);
  }
  // Clipped edge bands give the portals, tabletops and baseboards a real plane for grazing highlights.
  function chamfer(x,y,z,w,h,d,r,mat,o={}){
    r=Math.min(r,w*.24,h*.24,d*.24);const c=[x,y,z],s=[w/2,h/2,d/2];
    if(o.shadow!==false)occluders.push({min:c.map((v,i)=>v-s[i]+r*.28),max:c.map((v,i)=>v+s[i]-r*.28),group:o.group||''});
    for(let i=0;i<3;i++){
      const j=(i+1)%3,k=(i+2)%3;
      for(const sign of [-1,1]){
        const p=plus(c,axis(i,sign*s[i]));
        toward(p,axis(j,2*(s[j]-r)),axis(k,2*(s[k]-r)),axis(i,sign),mat,o);
      }
      for(const a of [-1,1])for(const b of [-1,1]){
        const p=plus(plus(c,axis(j,a*(s[j]-r*.5))),axis(k,b*(s[k]-r*.5)));
        toward(p,axis(i,2*(s[i]-r)),plus(axis(j,-a*r),axis(k,b*r)),plus(axis(j,a),axis(k,b)),mat,o);
      }
    }
  }
  function cylinder(x,y,z,rt,rb,h,mat,o={}){
    curves.push({kind:'cylinder',p:[x,y,z],rt,rb,h,mat,segments:o.segments??24,axis:o.axis??[0,1,0],group:o.group||''});
  }
  function rod(a,b,r,mat,r2=r,o={}){
    const v=diff(b,a);cylinder(...times(plus(a,b),.5),r2,r,Math.hypot(...v),mat,{...o,axis:unit(v),segments:o.segments??10});
  }
  function oval(x,y,z,sx,sy,sz,mat,angle=0,group=''){
    curves.push({kind:'sphere',p:[x,y,z],scale:[sx,sy,sz],angle,mat,group});
  }
  // Lathed metal and ceramic parts. A row is the radius and elevation above the part's seat.
  function turned(x,y,z,profile,mat,o={}){
    for(let k=1;k<profile.length;k++){
      const [r0,h0]=profile[k-1],[r1,h1]=profile[k];
      if(h1>h0)cylinder(x,y+(h0+h1)/2,z,r1,r0,h1-h0,mat,o);
    }
  }
  function source(x,y,z,power,radius,group,shape,color,more={}){
    lights.push({position:[x,y,z],power,radius,group,shape,color,...more});
  }
  function ceilingLight(z,i){
    const group='drum'+i, o={group,segments:68}, c=Y-.215;
    turned(0,c+.075,z,[[.079,0],[.079,.047],[.125,.054],[.13,.066],[.13,.078],[.19,.099],[.20,.112],[.20,.126]],'antique',o);
    cylinder(0,c,z,.392,.392,.148,'drum',o);
    // A theatre-style milk-glass bowl, enclosed by two browning bronze rings.
    turned(0,c-.124,z,[[.261,0],[.307,.007],[.355,.023],[.382,.047],[.388,.055],[.390,.065]],'diffuser',o);
    turned(0,c-.089,z,[[.387,0],[.398,.002],[.411,.008],[.410,.019],[.399,.023],[.395,.027]],'antique',o);
    cylinder(0,c+.078,z,.411,.406,.015,'antique',o);
    cylinder(0,c+.029,z,.3975,.3975,.009,'bronze',o);
    for(let k=0;k<12;k++){
      const a=k*Math.PI/6;
      rod([.392*Math.cos(a),c-.064,z+.392*Math.sin(a)],[.392*Math.cos(a),c+.074,z+.392*Math.sin(a)],.004,'antique',.004,o);
    }
    turned(0,c-.144,z,[[.020,0],[.028,.009],[.041,.012],[.042,.022]],'brass',o);
    const power=[3.8,2.25,3.3,2.05,3.0,2.15,3.4][i];
    source(0,c-.052,z,power,.36,group,'drum',[1,.856,.716],{shadeHeight:.15,direction:[0,-1,0]});
  }
  function shade(x,c,z,group,big=false){
    const bottom=big?.207:.151,top=big?.174:.124,h=big?.344:.282,o={group,segments:60};
    cylinder(x,c,z,top,bottom,h,'shade',o);
    for(const [y,r] of [[-.5,bottom],[.5,top]])cylinder(x,c+y*h,z,r+.0015,r+.0015,.009,'shadeSeam',o);
    cylinder(x,c-h*.5+.003,z,bottom*.88,bottom*.88,.005,'diffuser',o);
    // A bound vertical seam and three slim ribs are visible across the bottom opening.
    rod([x+top,c+h*.49,z],[x+bottom,c-h*.49,z],.0017,'shadeSeam',.0017,o);
    for(let k=0;k<3;k++){
      const a=k*2*Math.PI/3;
      rod([x,c-h*.50-.006,z],[x+Math.cos(a)*bottom*.93,c-h*.50+.002,z+Math.sin(a)*bottom*.93],.0025,'antique',.0025,o);
    }
  }
  function sconce(side,z,i,offset=0){
    const group='wall'+side+'-'+i,wx=side*X,sx=side*(X-.228),c=1.60+offset,o={group,axis:[side,0,0],segments:32};
    cylinder(wx-side*.03,c-.18,z,.059,.059,.027,'antique',o);
    cylinder(wx-side*.053,c-.18,z,.050,.050,.017,'brass',o);
    rod([wx-side*.048,c-.18,z],[sx+side*.037,c-.237,z],.012,'antique',.013,{group});
    rod([sx+side*.037,c-.237,z],[sx,c-.220,z],.013,'antique',.011,{group});
    turned(sx,c-.251,z,[[.026,0],[.024,.018],[.014,.025],[.014,.056],[.034,.066],[.037,.080],[.033,.094],[.016,.104]],'brass',{group});
    shade(sx,c,z,group);
    source(sx,c,z,1.06+(i%3)*.14,.14,group,'sconce',[1,.711,.462],{wallSide:side,shadeHeight:.282});
  }
  function tableLamp(x,y,z,side,i){
    const group='table'+side+'-'+i, o={group,segments:44};
    turned(x,y,z,[[.103,0],[.115,.007],[.116,.019],[.105,.028],[.103,.032],[.077,.039],[.066,.051],[.047,.083],[.042,.098]],'antique',o);
    turned(x,y+.095,z,[[.043,0],[.057,.010],[.060,.019],[.055,.030],[.041,.042],[.030,.075],[.023,.117],[.021,.180],[.032,.205],[.035,.217],[.029,.229],[.019,.235]],'brass',o);
    cylinder(x,y+.360,z,.013,.016,.075,'antique',o);
    const c=y+.544;
    shade(x,c,z,group,true);
    turned(x,c+.165,z,[[.017,0],[.016,.012],[.010,.017],[.009,.032],[.016,.035],[.016,.047],[.008,.053]],'antique',o);
    source(x,c,z,1.72,.185,group,'table',[1,.703,.422],{wallSide:side,shadeHeight:.344});
  }
  function branchVase(x,y,z,sgn,variant){
    const o={segments:36};
    const profile=[[.037,0],[.047,.011],[.060,.032],[.072,.070],[.072,.115],[.063,.144],[.040,.169],[.031,.190],[.032,.213],[.037,.219],[.036,.225]];
    turned(x,y,z,profile,'ceramic',o);cylinder(x,y+.224,z,.028,.028,.003,'keyslot',o);
    // Three cut stems with forked twigs. Tiny sparse buds leave the outline of each branch legible.
    for(let i=0;i<3;i++){
      const s= i===1?-1:1;
      const a=[x+.005*(i-1),y+.214,z+.010*(i-1)];
      const b=[x+sgn*(.016+.025*i),y+.317+i*.012,z+s*.046];
      const c=[b[0]+sgn*.025,y+.39+i*.023,b[2]+s*(.028+.016*i)];
      const e=[c[0]-sgn*.011,c[1]+.044,c[2]+s*.042];
      rod(a,b,.0028,'stem',.0019);rod(b,c,.002,'stem',.0014);rod(c,e,.0015,'stem',.0007);
      const fork=[b[0]-sgn*.045,b[1]+.077,b[2]+s*.015];rod(b,fork,.0016,'stem',.0007);
      for(const [k,p] of [c,e,fork].entries()){
        oval(p[0],p[1]+.004,p[2],.008,.015,.004,'leaf',sgn*(k%2?.58:-.55));
        if(variant===0&&k!==0)oval(p[0]-.004,p[1]+.012,p[2]+.006,.006,.007,.005,'petal',k*.51);
      }
    }
  }
  function consoleTable(side,z,i){
    const x=side*(X-.213),h=.77,l=1.27;
    // Captive dark-stone slab above a stepped walnut drawer and brass shadow line.
    chamfer(x,h,z,.394,.037,l,.005,'stone');
    chamfer(x,h-.029,z,.383,.017,l-.018,.003,'antique');
    chamfer(x,h-.080,z,.325,.092,l-.075,.005,'wood');
    for(const ss of [-1,1]){
      const dz=z+ss*.286;
      chamfer(x-side*.171,h-.078,dz,.023,.074,.542,.003,'flute');
      rod([x-side*.185,h-.074,dz-.058],[x-side*.206,h-.075,dz-.058],.005,'brass');
      rod([x-side*.206,h-.075,dz-.058],[x-side*.206,h-.075,dz+.058],.005,'brass');
      rod([x-side*.206,h-.075,dz+.058],[x-side*.185,h-.074,dz+.058],.005,'brass');
    }
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const lx=x+sx*.129,lz=z+sz*.53;
      cylinder(lx,.351,lz,.018,.009,.62,'trim',{segments:15});
      turned(lx,.009,lz,[[.009,0],[.012,.003],[.012,.043],[.010,.051]],'antique',{segments:16});
      cylinder(lx,.650,lz,.021,.018,.020,'brass',{segments:18});
    }
    for(const dz of [-.53,.53])rod([x-.129,.16,z+dz],[x+.129,.16,z+dz],.0065,'antique');
    rod([x,.16,z-.53],[x,.16,z+.53],.006,'antique');
    const arrangement=side*(i%2===0?1:-1);
    tableLamp(x-side*.017,h+.020,z+arrangement*.272,side,i);
    branchVase(x+side*.012,h+.020,z-arrangement*.373,-side,i%2);
  }
  function framedPrint(side,z,w=.58,h=.72){
    const x=side*(X-.043),y=1.50,normal=[-side,0,0],fg=x-side*.040;
    box(x,y,z,.055,h,w,'wood',{density:16});
    for(const s of [-1,1]){
      chamfer(fg,y+s*(h/2-.013),z,.026,.027,w,.004,'antique');
      chamfer(fg,y,z+s*(w/2-.013),.026,h-.036,.027,.003,'antique');
    }
    toward([fg,y,z],[0,0,side*(w-.033)],[0,h-.033,0],normal,'paper',{stretch:true});
    toward([fg-side*.0014,y,z],[0,0,side*(w-.112)],[0,h-.130,0],normal,'print',{stretch:true});
  }
  // A softly faced panel has a narrow rounded shoulder before the dark reveal.
  function paddedPanel(side,za,zb,ya,yb,mat){
    const c=(za+zb)/2,cy=(ya+yb)/2,w=zb-za,h=yb-ya,r=.010;
    const normal=[-side,0,0],front=side*(X-.016);
    toward([front,cy,c],[0,0,side*(w-2*r)],[0,h-2*r,0],normal,mat);
    for(let k=0;k<3;k++){
      const a=k*Math.PI/6,b=(k+1)*Math.PI/6;
      const dx=r*(Math.cos(a)-Math.cos(b)),extent=r*(Math.sin(b)-Math.sin(a)),off=r*(Math.sin(a)+Math.sin(b))*.5;
      const x=front+side*r*(1-(Math.cos(a)+Math.cos(b))*.5);
      for(const s of [-1,1]){
        toward([x,cy,c+s*(w/2-r+off)],[side*dx,0,s*extent],[0,h-r,0],[-side,0,s],mat,{density:14});
        toward([x,cy+s*(h/2-r+off),c],[0,0,w-r],[side*dx,s*extent,0],[-side,s,0],mat,{density:14});
      }
    }
  }
  function field(side,za,zb){
    if(zb-za<.10)return;
    const inside=side===1?1:0,c=(za+zb)/2,w=zb-za;
    box(side*(X+.052),Y/2,c,.087,Y,w,'trim',{sides:[inside],density:8});
    const count=Math.max(1,Math.round(w/1.33)),unit=w/count;
    for(let j=0;j<count;j++){
      const l=za+j*unit+.0045,r=za+(j+1)*unit-.0045;
      paddedPanel(side,l,r,.134,.885,'padded');
      paddedPanel(side,l,r,.895,Y-.116,'wall');
    }
    box(side*(X-.023),.060,c,.082,.12,w,'trim',{sides:[inside,2],density:18});
    chamfer(side*(X-.018),.123,c,.074,.016,w,.003,'wood',{density:12});
  }
  function door(side,center,i){
    const inside=side===1?1:0,depth=.292,w=1.15,outer=.748;
    const rear=side*(X+depth),fg=side*(X-.029),wallX=side*X;
    box(rear+side*.044,1.15,center,.088,2.32,2*outer,'trim',{sides:[inside]});
    chamfer(rear-side*.018,1.104,center,.060,2.186,w,.004,'door');
    for(const s of [-1,1]){
      // Oak reveal extends from the hallway into the recessed door, with a planted stop.
      box(side*(X+depth*.50),1.16,center+s*(outer-.051),depth+.075,2.32,.109,'wood');
      chamfer(rear-side*.063,1.110,center+s*(w/2+.021),.048,2.22,.044,.006,'wood');
      chamfer(fg,1.181,center+s*(outer-.032),.082,2.363,.084,.008,'trim');
      box(fg-side*.042,1.18,center+s*(outer-.055),.008,2.352,.013,'wood',{sides:[inside],density:8});
    }
    box(side*(X+depth*.50),2.258,center,depth+.077,.103,2*outer,'wood');
    chamfer(fg,2.325,center,.083,.087,2*outer+.022,.008,'trim');
    // The wall over the portal is a padded transom. The slight set-back produces a continuous ceiling shadow.
    box(wallX+side*.023,(Y+2.345)/2,center,.069,Y-2.345,2*outer+.015,'wall',{sides:[inside,3]});
    for(const yy of [.265,1.944]){
      box(rear-side*.0487,yy,center,.002,.003,w-.048,'antique',detail);
    }
    const hand=(side===1?1:-1),keyZ=center+hand*.413,dh=rear-side*.055,cy=1.014;
    chamfer(dh,cy+.034,keyZ,.019,.182,.053,.004,'antique',detail);
    box(dh-side*.011,cy+.083,keyZ,.008,.043,.035,'keyslot',detail);
    cylinder(dh-side*.027,cy,keyZ,.019,.019,.037,'brass',{axis:[side,0,0],segments:20});
    rod([dh-side*.044,cy,keyZ],[dh-side*.073,cy+.001,keyZ-hand*.013],.010,'brass');
    rod([dh-side*.073,cy+.001,keyZ-hand*.013],[dh-side*.071,cy+.003,keyZ-hand*.118],.010,'brass',.008);
    cylinder(dh,1.52,center,.010,.010,.014,'brass',{axis:[1,0,0],segments:17});
    const pz=center+outer+.143;
    chamfer(side*(X-.041),1.46,pz,.032,.116,.186,.005,'antique',detail);
    face([side*(X-.059),1.46,pz],[0,0,side*.175],[0,.106,0],i%2===0?'plate528':'plate491',{stretch:true,small:true});
  }
  function bayWall(side,start,i){
    const offset=(side===1?.99:1.17)+[0,.10,-.08,.13,-.06,.07,-.03][i], d=start+offset, rw=.758;
    field(side,start,d-rw);door(side,d,i);field(side,d+rw,start+BAY);
    const lightZ=start+(side===1?2.64:3.48)+(i%3-1)*.085;
    const hasConsole=side===-1?(i===0||i===4):(i===1||i===5);
    if(hasConsole)consoleTable(side,lightZ,i);
    else sconce(side,lightZ,i);
    if(!hasConsole&&((side===1&&i%3===0)||(side===-1&&i%3===2))){
      framedPrint(side,start+(side===1?3.76:2.42),i%2?.56:.63,i%2?.70:.65);
    }
  }
  function cornice(side,z){
    const inside=side===1?1:0;
    box(side*(X-.015),Y-.077,z,.099,.088,BAY,'trim',{sides:[inside,3]});
    chamfer(side*(X-.028),Y-.116,z,.075,.020,BAY,.006,'wood',{density:17});
    box(side*(X-.09),Y-.034,z,.13,.070,BAY,'ceiling',{sides:[inside,3]});
    toward([side*(X-.159),Y-.023,z],[0,0,BAY],[-side*.052,.044,0],[-side,-1,0],'ceiling',{density:30});
  }
  for(let i=0;i<BAYS;i++){
    const z=i*BAY,mid=z+BAY/2;
    face([0,0,mid],[WIDTH+.72,0,0],[0,0,-BAY],'carpet');
    face([0,Y,mid],[WIDTH+.03,0,0],[0,0,BAY],'ceiling');
    for(const s of [-1,1]){bayWall(s,z,i);cornice(s,mid);}
    ceilingLight(z+2.60,i);
  }
  // A shallow, backlit lift lobby closes the axis with a distinct luminous focal point.
  function endBay(z,dir){
    const group='end'+dir,inner=z+dir*.041;
    face([0,Y/2,z],[dir*WIDTH,0,0],[0,Y,0],'wood');
    for(const sign of [-1,1]){
      const cx=sign*.52;
      box(cx,1.15,inner,1.013,2.30,.066,'door');
      chamfer(cx,1.568,z+dir*.088,.729,1.228,.043,.008,'antique');
      face([cx,1.568,z+dir*.111],[dir*.689,0,0],[0,1.188,0],'opal',{unlit:true,group});
      for(let j=-8;j<=8;j++){
        const xx=cx+j*.039;
        cylinder(xx,1.569,z+dir*.111,.005,.005,1.172,'opal',{group,segments:8});
      }
      for(const sy of [-1,1]){
        chamfer(cx,1.568+sy*.59,z+dir*.119,.70,.017,.018,.003,'brass',detail);
      }
      chamfer(cx-sign*.339,.83,z+dir*.097,.031,.286,.019,.004,'antique',detail);
      rod([cx-sign*.339,.742,z+dir*.130],[cx-sign*.339,.924,z+dir*.130],.010,'brass');
      box(sign*1.109,1.16,z+dir*.045,.11,2.32,.103,'trim');
      source(cx,1.66,z+dir*.165,1.39,.38,group,'fill',[.853,.91,1],{direction:[0,0,dir],shadeHeight:.80});
    }
    box(0,2.337,z+dir*.049,2.33,.113,.116,'trim');
    for(const s of [-1,1]){
      chamfer(s*1.397,1.354,z+dir*.035,.485,2.395,.060,.010,'padded');
      for(let j=0;j<7;j++)box(s*(1.184+j*.062),.697,z+dir*.072,.009,1.012,.011,'wood',{small:true,shadow:false});
    }
    box(0,.015,z+dir*.082,2.206,.025,.155,'antique',{sides:[2]});
  }
  endBay(0,1);endBay(LENGTH,-1);
  const atlasWidth=2048;
  let px=0,py=0,row=0;
  for(const chart of [...charts].sort((a,b)=>b.h-a.h)){
    if(px+chart.w>atlasWidth){py+=row;px=0;row=0;}
    chart.rect=[px,py,chart.w,chart.h];px+=chart.w;row=Math.max(row,chart.h);
  }
  return {charts,occluders,lights,faces,curves,atlasWidth,atlasHeight:Math.ceil((py+row)/64)*64};
}
