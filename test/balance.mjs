// Multi-seed balance harness. Runs every character over many seeds with a kiting bot
// for a fixed sim duration, then reports median survival time / level so tuning decisions
// are made on stable signal, not a single noisy run.
function makeCtx(){const n=()=>{};const g={addColorStop:n};return new Proxy({canvas:{width:0,height:0},createLinearGradient:()=>g,createRadialGradient:()=>g,getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(1,(w|0)*(h|0)*4)),width:w|0,height:h|0}),putImageData:n,drawImage:n,fillRect:n,strokeRect:n,clearRect:n,beginPath:n,closePath:n,moveTo:n,lineTo:n,arc:n,ellipse:n,rect:n,fill:n,stroke:n,clip:n,save:n,restore:n,translate:n,rotate:n,scale:n,setTransform:n,transform:n,quadraticCurveTo:n,bezierCurveTo:n,fillText:n,strokeText:n,measureText:()=>({width:0}),createPattern:()=>({}),setLineDash:n,arcTo:n,roundRect:n},{get(t,k){return k in t?t[k]:undefined},set(t,k,v){t[k]=v;return true}});}
function makeCanvas(){const cv={width:0,height:0,style:{}};cv.getContext=()=>makeCtx();return cv;}
globalThis.document={createElement:t=>t==='canvas'?makeCanvas():{style:{}}};
globalThis.window=globalThis; globalThis.performance=globalThis.performance||{now:()=>0};

const { Game, makePlayer } = await import('../public/js/game/game.js');
const { STAGES } = await import('../public/js/data/stages.js');
const { CHARACTERS } = await import('../public/js/data/characters.js');

const SECONDS = +(process.argv[2] || 600);   // sim duration cap
const SEEDS = +(process.argv[3] || 6);
const STAGE = +(process.argv[4] || 0);

function run(charId, seed) {
  const stage = STAGES[STAGE];
  const cb = { sfx(){}, toast(){}, boss(){}, bossKilled(){}, evolve(){}, coopRevive(){},
    levelup(pl, ch){ if (ch && ch[0]) game.applyChoice(pl, ch[0]); }, gameover(){} };
  let bt = 0;
  const game = new Game({ stage, seed, callbacks: cb });
  function bot() {
    const me = game.players[0]; if (!me) return { x: 0, y: 0 };
    let cx=0,cy=0,n=0;
    for (const e of game.enemies){const dx=e.x-me.x,dy=e.y-me.y,d2=dx*dx+dy*dy;if(d2<220*220){const w=1/(d2+400);cx+=dx*w;cy+=dy*w;n++;}}
    let gx=0,gy=0,gd=1e18;
    for (const g2 of game.gems){const dx=g2.x-me.x,dy=g2.y-me.y,d2=dx*dx+dy*dy;if(d2<gd){gd=d2;gx=dx;gy=dy;}}
    let mx,my;
    if(n){
      // Pure kite: always flee the horde. Curve toward a nearby gem only when it doesn't
      // mean heading deeper into enemies (away·gem > 0). Models a skilled VS player.
      let ax=-cx,ay=-cy;const am=Math.hypot(ax,ay)||1;ax/=am;ay/=am;
      mx=ax;my=ay;
      if(gd<200*200){const gm=Math.hypot(gx,gy)||1;const gnx=gx/gm,gny=gy/gm;if(gnx*ax+gny*ay>-0.1){mx=ax*0.8+gnx*0.5;my=ay*0.8+gny*0.5;}}
    }
    else if(gd<1e17){const gm=Math.hypot(gx,gy)||1;mx=gx/gm;my=gy/gm;}
    else{mx=Math.cos(bt*0.5);my=Math.sin(bt*0.5);}
    const m=Math.hypot(mx,my)||1;return{x:mx/m,y:my/m};
  }
  const pl = makePlayer(game, 0, charId, { type: 'local', getMove: bot });
  game.players.push(pl);
  const dt = 1/60, frames = Math.floor(SECONDS/dt);
  for (let f=0; f<frames; f++){ bt+=dt; game.update(dt); if (game.state==='over'||game.state==='win') break; }
  return { t: game.time, lv: pl.level, kills: game.kills, evolved: pl.weapons.some(s=>{const W=game._WEAPON_MAP;return false;}) || pl.weapons.filter(s=>s.id&&s.level).length, weapons: pl.weapons.length, win: game.state==='win' };
}
const median = a => { const s=[...a].sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; };
console.log(`Balance: ${SECONDS}s cap, ${SEEDS} seeds, stage "${STAGES[STAGE].name}"\n`);
console.log('char       | medSurvive | medLv | medKills | wins');
for (const c of CHARACTERS) {
  const rs = []; for (let s=0;s<SEEDS;s++) rs.push(run(c.id, 1000+s*37));
  const ts = rs.map(r=>r.t), lvs = rs.map(r=>r.lv), ks = rs.map(r=>r.kills);
  const wins = rs.filter(r=>r.win).length;
  console.log(`${c.id.padEnd(10)} | ${String(Math.round(median(ts))+'s').padStart(9)} | ${String(median(lvs)).padStart(5)} | ${String(median(ks)).padStart(8)} | ${wins}/${SEEDS}`);
}
