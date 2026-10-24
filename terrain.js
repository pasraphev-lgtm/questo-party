export function segmentDistance(x,z,a,b,c,d){const dx=c-a,dz=d-b,t=Math.max(0,Math.min(1,((x-a)*dx+(z-b)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a-dx*t,z-b-dz*t)}
export function onTerrain(layout,x,z,margin=.35){return layout.pads.some(([a,b,rx,rz])=>((x-a)/(rx-margin))**2+((z-b)/(rz-margin))**2<1)||layout.links.some(([a,b,c,d,width])=>segmentDistance(x,z,a,b,c,d)<width/2-margin)}
export function canStand(layout,obstacles,x,z){
 if(!onTerrain(layout,x,z))return false;
 const [lx,lz,rx,rz]=layout.lake;
 const inLake=((x-lx)/(rx+.35))**2+((z-lz)/(rz+.35))**2<1;
 const dock=x>=lx-rx-1.6&&x<=lx-.7&&Math.abs(z-lz)<.75;
 return(!inLake||dock)&&!obstacles.some(([a,b,r])=>Math.hypot(x-a,z-b)<r+.3);
}

