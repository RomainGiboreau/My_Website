"""Generate the 8 animated SVG diagrams of the home-page Expertise carousel.

Usage:  python scripts/expertise_svgs.py out.txt   -> one <svg> per line, in card order.
Paste each line into the matching <div class="xp-img"> in docs/index.md.
Animation classes (a-draw, a-fade, a-pop, a-rise, a-down, a-flow, delay via --d)
are defined in docs/stylesheets/extra.css and triggered by docs/javascripts/expertise.js.
"""
import math,sys,random
FG,MUT,LT,LINE,ACC,CU,GRN,BLUE,PAPER='#232220','#5c5a52','#8a8778','#c9c4b6','#4a5a4e','#a8623a','#4f6b3c','#4a6f8f','#f5f3ed'
W,H=320,200
# hydrocarbon phases: dark green (heavy oil) -> light green (light oil) -> yellow-orange (condensate) -> red (gas)
IMM,HEAVY,LIGHTO,COND,COND2,GAS,OILC='#e4e1d6','#2f5d34','#a9cf8c','#efc04f','#e8913a','#c8402f','#3f7a3a'
HALO=' paint-order="stroke" stroke="#f5f3ed" stroke-width="3" stroke-linejoin="round"'
def f1(v): return f'{v:.1f}'
def g1(v): s=f'{v:.1f}'.rstrip('0').rstrip('.'); return '0' if s=='-0' else s
def path(pts):   # compact: implicit lineto, no trailing zeros, consecutive duplicates dropped
    q=[f'{g1(x)},{g1(y)}' for x,y in pts]; q=[c for i,c in enumerate(q) if i==0 or c!=q[i-1]]
    return 'M'+' '.join(q)
def T(x,y,s,size=10,fill=MUT,anchor='start',weight=400,cls='',d=None,extra=''):
    c=f' class="{cls}"' if cls else ''; st=f' style="--d:{d}s"' if d is not None else ''
    return f'<text x="{f1(x)}" y="{f1(y)}" font-size="{size}" fill="{fill}" text-anchor="{anchor}" font-weight="{weight}"{c}{st}{extra}>{s}</text>'
def A(cls,d): return f' class="{cls}" style="--d:{d}s"'
def svg(body,label): return f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="{label}" font-family="Inter,sans-serif">{body}</svg>'
def marker(id,col): return f'<defs><marker id="{id}" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L8,4 L0,8z" fill="{col}"/></marker></defs>'
def frame(x0,x1,y0,y1,xt,yt,xlab,ylab,xtop=False,grid=True):
    """xt/yt: lists of (pixel,label). xtop: x axis drawn at top (depth plots)."""
    b=''
    ya=y0 if xtop else y1
    if grid:
        for px,_ in xt: b+=f'<line x1="{f1(px)}" y1="{y0}" x2="{f1(px)}" y2="{y1}" stroke="{LINE}" stroke-width=".5" opacity=".7"/>'
        for py,_ in yt: b+=f'<line x1="{x0}" y1="{f1(py)}" x2="{x1}" y2="{f1(py)}" stroke="{LINE}" stroke-width=".5" opacity=".7"/>'
    b+=f'<line x1="{x0}" y1="{ya}" x2="{x1}" y2="{ya}" stroke="{FG}" stroke-width=".9"/><line x1="{x0}" y1="{y0}" x2="{x0}" y2="{y1}" stroke="{FG}" stroke-width=".9"/>'
    for px,l in xt:
        b+=f'<line x1="{f1(px)}" y1="{ya}" x2="{f1(px)}" y2="{ya+(-3 if xtop else 3)}" stroke="{FG}" stroke-width=".9"/>'
        b+=T(px,ya-6 if xtop else ya+13,l,9.5,MUT,'middle')
    for py,l in yt:
        b+=f'<line x1="{x0-3}" y1="{f1(py)}" x2="{x0}" y2="{f1(py)}" stroke="{FG}" stroke-width=".9"/>'+T(x0-5,py+3.3,l,9.5,MUT,'end')
    if xlab: b+=T((x0+x1)/2,ya-17 if xtop else ya+25,xlab,9.5,LT,'middle')
    if ylab: b+=f'<text x="10" y="{f1((y0+y1)/2)}" font-size="9.5" fill="{LT}" text-anchor="middle" transform="rotate(-90 10 {f1((y0+y1)/2)})">{ylab}</text>'
    return b
out=[]

# ---------- 1. Petroleum system cross-section (two-phase trap) ----------
X=list(range(30,321,4))
def h(x,y0,A=30): return y0-A*math.exp(-((x-222)/50)**2)+0.12*(222-x)
ys=[58,80,96,124,140]
fills=['#a9a291','#cfd3c8','#e6d6b0','#d9d5c8','#4f4d47','#c9c4b6']
top=[(x,14) for x in X]; bot=[(x,186) for x in X]
L=[top]+[[(x,h(x,y)) for x in X] for y in ys]+[bot]
b=marker('m1g',GAS)+marker('m1o',OILC)+'<clipPath id="xc1"><rect x="30" y="14" width="290" height="172"/></clipPath><g clip-path="url(#xc1)">'
for i in range(len(L)-1): b+=f'<path d="{path(L[i]+L[i+1][::-1])}Z" fill="{fills[i]}"/>'
for i in range(1,len(L)-1): b+=f'<path d="{path(L[i])}" fill="none" stroke="{MUT}" stroke-width=".6"/>'
res=[(x,h(x,ys[1])) for x in X]+[(x,h(x,ys[2])) for x in X][::-1]
crest=min(h(x,ys[1]) for x in X); goc=crest+6; owc=crest+12
b+=f'<clipPath id="xc1b"><path d="{path(res)}Z"/></clipPath><g clip-path="url(#xc1b)">'
b+=f'<rect x="30" y="{f1(goc)}" width="290" height="{f1(owc-goc)}" fill="{OILC}"{A("a-down",1.5)}/>'
b+=f'<rect x="30" y="{f1(crest-2)}" width="290" height="{f1(goc-crest+2)}" fill="{GAS}"{A("a-down",2.3)}/></g>'
# expulsion: deeper (more mature) kitchen gives gas, shallower one gives oil; both migrate up the carrier bed
mid=lambda x:(h(x,ys[1])+h(x,ys[2]))/2
for sx,col,dl in ((92,GAS,.3),(140,OILC,.3)):
    b+=f'<path d="M{sx},{f1(h(sx,ys[3])-1)} L{sx},{f1(mid(sx)+3)}" stroke="{col}" stroke-width="1.8" fill="none"{A("a-flow",dl)}/>'
b+=f'<path d="{path([(x,mid(x)-2.6) for x in range(92,214,4)])}" stroke="{GAS}" stroke-width="1.8" fill="none" marker-end="url(#m1g)"{A("a-flow",.6)}/>'
b+=f'<path d="{path([(x,mid(x)+2.6) for x in range(140,214,4)])}" stroke="{OILC}" stroke-width="1.8" fill="none" marker-end="url(#m1o)"{A("a-flow",.6)}/>'
b+='</g>'
# depth axis + scale bar
dz=lambda km:14+km*40
b+=f'<line x1="30" y1="14" x2="30" y2="186" stroke="{FG}" stroke-width=".9"/>'
for km in range(0,5): b+=f'<line x1="27" y1="{dz(km)}" x2="30" y2="{dz(km)}" stroke="{FG}" stroke-width=".9"/>'+T(25,dz(km)+3.3,str(km),9.5,MUT,'end')
b+=f'<text x="9" y="100" font-size="9.5" fill="{LT}" text-anchor="middle" transform="rotate(-90 9 100)">depth (km)</text>'
b+=f'<rect x="242" y="170" width="70" height="13" rx="2" fill="{PAPER}" opacity=".9"/><line x1="248" y1="178" x2="288" y2="178" stroke="{FG}" stroke-width="2"/>'+T(292,181.5,'10 km',9,FG)
b+=T(36,52,'overburden',10,FG)+T(36,h(36,ys[0])+14,'seal',10,FG)+T(36,h(36,ys[1])+12.5,'reservoir',10,FG)+T(36,h(36,ys[2])+16,'shale',10,FG)+T(36,h(36,ys[3])+12,'source rock',10,PAPER)
b+=T(222,crest-8,'two-phase trap',10.5,FG,'middle',700,'a-fade',2.6)
b+=f'<g{A("a-fade",.1)}><rect x="36" y="20" width="96" height="16" rx="3" fill="{PAPER}" opacity=".9"/><rect x="42" y="24" width="9" height="8" fill="{GAS}"/>'+T(55,31.5,'gas',9.5,FG)+f'<rect x="80" y="24" width="9" height="8" fill="{OILC}"/>'+T(93,31.5,'oil',9.5,FG)+'</g>'
out.append(svg(b,'Cross-section of a petroleum system: gas from the deeper kitchen and oil from the shallower one migrate along the carrier bed into a two-phase trap, gas cap over oil leg'))

# ---------- 2. Burial history ----------
x0,x1,y0,y1=40,296,30,190
ax=lambda a:x0+(150-a)/150*(x1-x0); ay=lambda d:y0+d/5*(y1-y0)
b=frame(x0,x1,y0,y1,[(ax(a),str(a)) for a in (150,100,50,0)],[(ay(d),str(d)) for d in range(6)],'age (Ma)','depth (km)',xtop=True,grid=False)
# temperature scale (surface 10 °C, 30 °C/km)
for d in range(6): b+=f'<line x1="{x1}" y1="{f1(ay(d))}" x2="{x1+3}" y2="{f1(ay(d))}" stroke="{FG}" stroke-width=".9"/>'+T(x1+5,ay(d)+3.3,str(10+30*d),8,MUT)
b+=f'<line x1="{x1}" y1="{y0}" x2="{x1}" y2="{y1}" stroke="{FG}" stroke-width=".9"/>'+T(x1+10,y0-6,'°C',8.5,LT)
# burial to a maximum at 10 Ma, then 0.4 km of uplift and erosion
UP,TU=.4,10
def dep(t,Aa,D):
    Dm=D+UP
    return Dm*((Aa-t)/(Aa-TU))**.72 if t>=TU else max(0,Dm-UP*(TU-t)/TU)
Hs=[(150,4.7),(118,3.8),(92,3.0),(66,2.15),(40,1.3),(16,.55)]
curves=[[(ax(t),ay(dep(t,Aa,D))) for t in [Aa-i*(Aa-TU)/40 for i in range(41)]+[5,0]] for Aa,D in Hs]
tones=['#d9d5c8','#4f4d47','#cfd3c8','#e6d6b0','#d9d5c8','#e6d6b0']   # layer 1 = source rock
for i,c in enumerate(curves):
    nxt=curves[i+1] if i+1<len(curves) else [(x1,y0)]
    poly=c+([(x1,ay(Hs[i+1][1]))] if i+1<len(curves) else [])+nxt[::-1]
    b+=f'<path d="{path(poly)}Z" fill="{tones[i]}"{A("a-fade",.4+i*.22)}/>'
# hydrocarbon windows: heavy -> light oil (dark -> light green), condensate (yellow-orange), gas (red)
dw=[(2.5,HEAVY),(3.3,LIGHTO),(3.7,COND),(4.0,COND2),(4.3,GAS),(5,GAS)]
b+=f'<defs><linearGradient id="g2fl" gradientUnits="userSpaceOnUse" x1="0" y1="{f1(ay(2.5))}" x2="0" y2="{y1}">'
for d,c in dw: b+=f'<stop offset="{(ay(d)-ay(2.5))/(y1-ay(2.5)):.3f}" stop-color="{c}"/>'
b+='</linearGradient></defs>'
b+=f'<clipPath id="xc2"><path d="{path(curves[0]+[(x1,y0)])}Z"/></clipPath>'   # windows only where sediment exists
b+=f'<rect x="{x0}" y="{f1(ay(2.5))}" width="{x1-x0}" height="{f1(y1-ay(2.5))}" fill="url(#g2fl)" fill-opacity=".55" clip-path="url(#xc2)"{A("a-fade",1.8)}/>'
for i,c in enumerate(curves): b+=f'<path d="{path(c)}" fill="none" stroke="{MUT}" stroke-width=".9" pathLength="1"{A("a-draw",i*.22)}/>'
b+=f'<line x1="{x0}" y1="{y0}" x2="{x1}" y2="{y0}" stroke="{FG}" stroke-width=".9"/>'
# source rock and the onset of generation (its base reaches the top of the oil window, 2.5 km)
ONSET=118-(118-TU)*(2.5/(3.8+UP))**(1/.72); mid=lambda c,a:min(c,key=lambda q:abs(q[0]-ax(a)))[1]
b+=T(ax(75),(mid(curves[1],75)+mid(curves[2],75))/2+3.3,'source rock',9,PAPER,'middle',700,'a-fade',1.0)
b+=f'<g{A("a-fade",2.4)}><line x1="{f1(ax(ONSET))}" y1="{y0}" x2="{f1(ax(ONSET))}" y2="{f1(ay(2.5))}" stroke="{FG}" stroke-width=".9" stroke-dasharray="3 2"/><circle cx="{f1(ax(ONSET))}" cy="{f1(ay(2.5))}" r="3.5" fill="{HEAVY}" stroke="{PAPER}" stroke-width="1.2"/></g>'
b+=T(ax(ONSET)+4,y0+12,f'onset ~{ONSET:.0f} Ma',9,FG,'start',700,'a-fade',2.4,HALO)+T(x1-4,ay(.62),'uplift',8.5,FG,'end',700,'a-fade',1.6,HALO)
for k,(d,lab) in enumerate([(2.85,'heavy oil'),(3.45,'light oil'),(3.9,'condensate'),(4.5,'gas')]):
    b+=T(x1-4,ay(d)+3.5,lab,9.5,FG,'end',700,'a-fade',2.1+k*.1,HALO)
out.append(svg(b,'Burial history with late uplift and a temperature scale: sediment layers subsiding through the heavy oil, light oil, condensate and gas windows over 150 million years'))

# ---------- 3. HI vs Tmax over hydrocarbon-generation zones ----------
x0,x1,y0,y1=42,306,34,166
tx=lambda t:x0+(t-400)/100*(x1-x0); hy=lambda v:y1-v/1000*(y1-y0)
roT=lambda ro:(ro+7.16)/0.018   # Jarvie et al. (2001): %Ro = 0.018 Tmax - 7.16
st=[(400,IMM),(roT(.6),IMM),(roT(.6),HEAVY),(roT(.95),LIGHTO),(roT(1.1),COND),(roT(1.25),COND2),(roT(1.4),GAS),(500,GAS)]
b=f'<defs><linearGradient id="g3fl" gradientUnits="userSpaceOnUse" x1="{x0}" y1="0" x2="{x1}" y2="0">'
for t,c in st: b+=f'<stop offset="{(t-400)/100:.3f}" stop-color="{c}"/>'
b+='</linearGradient></defs>'
b+=f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="url(#g3fl)" fill-opacity=".6"{A("a-fade",0)}/>'
b+=frame(x0,x1,y0,y1,[(tx(t),str(t)) for t in (400,425,450,475,500)],[(hy(v),str(v)) for v in (0,250,500,750,1000)],'Tmax (°C)','HI (mg HC/g TOC)')
# vitrinite reflectance scale on top
for ro in (0.6,0.8,1.0,1.3,1.6):
    t=roT(ro); b+=f'<line x1="{f1(tx(t))}" y1="{y0}" x2="{f1(tx(t))}" y2="{y0-3}" stroke="{FG}" stroke-width=".9"/>'+T(tx(t),y0-5,f'{ro:.1f}',9,MUT,'middle')
b+=f'<line x1="{x0}" y1="{y0}" x2="{x1}" y2="{y0}" stroke="{FG}" stroke-width=".9"/>'+T(x0,y0-5,'%Ro',9,LT,'start')
for name,H0,Tm,w in [('I',900,447,3.2),('II',640,452,6.5),('III',270,462,11)]:
    pts=path([(tx(t),hy(H0/(1+math.exp((t-Tm)/w)))) for t in [404+i*0.8 for i in range(120)]])
    b+=f'<path d="{pts}" fill="none" stroke="{PAPER}" stroke-width="4" stroke-linecap="round" pathLength="1"{A("a-draw",.6)}/>'
    b+=f'<path d="{pts}" fill="none" stroke="{FG}" stroke-width="1.7" pathLength="1"{A("a-draw",.6)}/>'
    b+=T(tx(410),hy(H0)+13,'Type '+name,10,FG,weight=700,cls='a-fade',d=1.5)
random.seed(3)
pts=[]
for H0,Tm,w,n,lo,hi in [(640,452,6.5,18,430,468),(900,447,3.2,5,432,452),(270,462,11,7,428,478)]:   # type II, I, III
    for k in range(n):
        t=random.uniform(lo,hi); pts.append((t,H0/(1+math.exp((t-Tm)/w))*random.uniform(.85,1.1)))
for k,(t,v) in enumerate(sorted(pts)):
    b+=f'<circle cx="{f1(tx(t))}" cy="{f1(hy(v))}" r="3" fill="{PAPER}" stroke="{FG}" stroke-width=".9"{A("a-pop",1.9+k*.06)}/>'
b+=f'<g{A("a-fade",.4)}><rect x="236" y="40" width="66" height="82" rx="3" fill="{PAPER}" fill-opacity=".92" stroke="{LINE}"/>'
for k,(c,lab) in enumerate([(IMM,'immature'),(HEAVY,'heavy oil'),(LIGHTO,'light oil'),(COND,'condensate'),(GAS,'gas')]):
    b+=f'<rect x="242" y="{58+k*12.4}" width="9" height="9" fill="{c}" stroke="{LINE}" stroke-width=".5"/>'+T(255,66+k*12.4,lab,9,FG)
b+=T(242,51,'zones: type II',8.5,MUT)+'</g>'
out.append(svg(b,'Hydrogen index against Tmax with kerogen type curves over the hydrocarbon-generation zones, heavy oil to light oil, condensate and gas, with a vitrinite reflectance scale'))

# ---------- 4. Pressure-depth through a two-phase trap ----------
x0,x1,y0,y1=40,310,30,190
P0,P1,D0,D1=10,60,1.0,3.5
px=lambda p:x0+(p-P0)/(P1-P0)*(x1-x0); dy=lambda d:y0+(d-D0)/(D1-D0)*(y1-y0)
b=frame(x0,x1,y0,y1,[(px(p),str(p)) for p in (10,20,30,40,50,60)],[(dy(d),f'{d:.1f}') for d in (1,1.5,2,2.5,3,3.5)],'pressure (MPa)','depth (km)',xtop=True)
st,sb,goc,fwl=1.9,2.1,2.45,2.8          # seal top/base (= crest), gas-oil contact, free-water level
gw,go,gg,gf,dP=10,7.5,2.0,16.8,8.0       # gradients (MPa/km) water, oil, gas, fracture; overpressure below the seal
pw=lambda d:gw*d+dP
p_fwl=pw(fwl); p_goc=p_fwl-go*(fwl-goc); p_cr=p_goc-gg*(goc-sb)
b+=f'<rect x="{x0}" y="{f1(dy(sb))}" width="{x1-x0}" height="{f1(dy(goc)-dy(sb))}" fill="{GAS}" fill-opacity=".16"{A("a-fade",.3)}/>'
b+=f'<rect x="{x0}" y="{f1(dy(goc))}" width="{x1-x0}" height="{f1(dy(fwl)-dy(goc))}" fill="{OILC}" fill-opacity=".16"{A("a-fade",.3)}/>'
b+=f'<rect x="{x0}" y="{f1(dy(st))}" width="{x1-x0}" height="{f1(dy(sb)-dy(st))}" fill="{MUT}" fill-opacity=".4"{A("a-fade",.2)}/>'+T(x0+4,dy(2.0)+3.3,'seal',9.5,FG,weight=600,cls='a-fade',d=.2)
for d,lab in ((goc,'GOC'),(fwl,'FWL')): b+=f'<line x1="{x0}" y1="{f1(dy(d))}" x2="{x1}" y2="{f1(dy(d))}" stroke="{MUT}" stroke-width=".6" stroke-dasharray="2 2"{A("a-fade",.3)}/>'+T(x0+4,dy(d)-2.5,lab,9,FG,weight=600,cls='a-fade',d=.3)
b+=f'<path d="M{f1(px(gw*D0))},{dy(D0)} L{f1(px(gw*D1))},{dy(D1)}" stroke="{BLUE}" stroke-width="1.4" pathLength="1"{A("a-draw",.1)}/>'
b+=f'<path d="M{f1(px(gf*D0))},{dy(D0)} L{f1(px(gf*D1))},{dy(D1)}" stroke="{MUT}" stroke-width="1.4" pathLength="1"{A("a-draw",.1)}/>'
# pore pressure: hydrostatic above the seal, rising through the seal to the gas pressure at the crest (continuous profile);
# the water gradient is extrapolated (dashed) through the hydrocarbon column to show the buoyancy pressure
b+=f'<path d="{path([(px(gw*D0),dy(D0)),(px(gw*st),dy(st)),(px(p_cr),dy(sb))])}" fill="none" stroke="{FG}" stroke-width="2" pathLength="1"{A("a-draw",.5)}/>'
b+=f'<path d="M{f1(px(pw(sb)))},{f1(dy(sb))} L{f1(px(p_fwl))},{f1(dy(fwl))}" stroke="{FG}" stroke-width="1" stroke-dasharray="3 2"{A("a-fade",1.2)}/>'
b+=f'<path d="M{f1(px(p_fwl))},{f1(dy(fwl))} L{f1(px(pw(D1)))},{dy(D1)}" stroke="{FG}" stroke-width="2" pathLength="1"{A("a-draw",1.0)}/>'
# hydrocarbon gradients built up from the free-water level
b+=f'<path d="M{f1(px(p_fwl))},{f1(dy(fwl))} L{f1(px(p_goc))},{f1(dy(goc))}" stroke="{OILC}" stroke-width="3" stroke-linecap="round" pathLength="1"{A("a-draw",1.4)}/>'
b+=f'<path d="M{f1(px(p_goc))},{f1(dy(goc))} L{f1(px(p_cr))},{f1(dy(sb))}" stroke="{GAS}" stroke-width="3" stroke-linecap="round" pathLength="1"{A("a-draw",2.1)}/>'
b+=T(px(gf*2.3)+10,dy(2.3)+3,f'gas {gg:g} MPa/km',9,GAS,weight=700,cls='a-fade',d=2.6,extra=HALO)
b+=T(px(gf*2.65)+10,dy(2.65)+3,f'oil {go:g} MPa/km',9,'#2f6b2f',weight=700,cls='a-fade',d=2.0,extra=HALO)
b+=T(px(pw(3.25))+7,dy(3.25)+3,f'water {gw:g} MPa/km',9,FG,weight=700,cls='a-fade',d=2.0,extra=HALO)
b+=f'<g{A("a-fade",.3)}><rect x="200" y="38" width="106" height="46" rx="3" fill="{PAPER}" stroke="{LINE}"/>'
for k,(col,lab) in enumerate([(BLUE,'hydrostatic'),(MUT,'fracture (Shmin)'),(FG,'pore pressure')]): b+=f'<line x1="206" y1="{49+k*13}" x2="220" y2="{49+k*13}" stroke="{col}" stroke-width="2"/>'+T(225,52.5+k*13,lab,9.5,FG)
b+='</g>'
out.append(svg(b,'Pressure against depth through a two-phase trap below a seal: gas and oil gradients built up from the free-water level, overpressured water and fracture pressure'))

# ---------- 5. Prospect evaluation ----------
x0,x1,y0,y1=42,300,16,166
lx=lambda v:x0+math.log10(v)/3*(x1-x0); py=lambda p:y1-p*(y1-y0)
mu,sg=math.log(50),1.0; Phi=lambda z:.5*(1+math.erf(z/math.sqrt(2))); POS=.32
b=frame(x0,x1,y0,y1,[(lx(v),str(v)) for v in (1,10,100,1000)],[(py(p),f'{int(p*100)}') for p in (0,.25,.5,.75,1)],'recoverable volume (MMbbl, log)','exceedance (%)')
# volume histogram: relative frequency only (no scale), drawn under the curves
for i in range(30):
    a,c=i*3/30,(i+1)*3/30; vm=10**((a+c)/2); d=math.exp(-((math.log(vm)-mu)/sg)**2/2)
    if d<.02: continue
    b+=f'<rect x="{f1(lx(10**a)+.7)}" y="{f1(y1-d*58)}" width="{f1(lx(10**c)-lx(10**a)-1.4)}" height="{f1(d*58)}" fill="{LINE}" fill-opacity=".8"{A("a-rise",i*.03)}/>'
b+=T(lx(9)-2,y1-12,'frequency',9,LT,'end',cls='a-fade',d=.6,extra=' font-style="italic"')
cur=[(lx(10**(i*3/120)),1-Phi((math.log(10**(i*3/120))-mu)/sg)) for i in range(121)]
b+=f'<path d="{path([(x,py(q)) for x,q in cur])}" fill="none" stroke="{ACC}" stroke-width="2.2" pathLength="1"{A("a-draw",.9)}/>'
# risked curve = POS x unrisked: starts at the probability of success
b+=f'<path d="{path([(x,py(POS*q)) for x,q in cur])}" fill="none" stroke="{ACC}" stroke-width="1.6" stroke-dasharray="4 3"{A("a-fade",2.0)}/>'
b+=T(lx(1.15),py(1)+12,'unrisked',9,ACC,weight=700,cls='a-fade',d=1.6)+T(lx(1.15),py(POS)-5,'risked (× POS)',9,ACC,weight=700,cls='a-fade',d=2.2)
for k,(lab,p,z) in enumerate([('P90',.9,-1.2816),('P50',.5,0),('P10',.1,1.2816)]):
    v=math.exp(mu+z*sg);X_,Y_=lx(v),py(p);dd=2.1+k*.25
    b+=f'<g{A("a-fade",dd)}><line x1="{f1(X_)}" y1="{f1(Y_)}" x2="{f1(X_)}" y2="{y1}" stroke="{CU}" stroke-dasharray="3 2"/><circle cx="{f1(X_)}" cy="{f1(Y_)}" r="3.5" fill="{CU}"/></g>'+(T(X_-7,Y_+4,f'{lab} · {v:.0f}',10,CU,'end',700,'a-fade',dd) if lab=='P50' else T(X_+6,Y_-5,f'{lab} · {v:.0f}',10,CU,weight=700,cls='a-fade',d=dd))   # P50 label left of its point, clear of the POS box
b+=f'<g{A("a-fade",2.8)}><rect x="214" y="22" width="80" height="78" rx="3" fill="{PAPER}" stroke="{ACC}"/>'
for k,(lab,v) in enumerate([('charge',.80),('reservoir',.80),('trap',.70),('seal',.71)]):
    b+=T(220,36+k*12,lab,9,MUT)+T(288,36+k*12,f'{v:.2f}',9,FG,'end')
b+=f'<line x1="220" y1="{f1(36+3*12+5)}" x2="288" y2="{f1(36+3*12+5)}" stroke="{LINE}"/>'+T(220,93,'POS',10,ACC,weight=700)+T(288,93,'32 %',10,ACC,'end',700)+'</g>'
out.append(svg(b,'Unrisked and risked volume exceedance curves with P90, P50 and P10, the volume frequency distribution and the probability of success as the product of charge, reservoir, trap and seal chances'))

# ---------- 6. Forward stratigraphic model: one sea-level cycle ----------
# Each step deposits a clinoform with its topset at sea level and shelf break at xb; the new surface
# only builds up (min in screen y), so falling sea level gives downstepping wedges and a basin-floor fan,
# rising sea level gives thin backstepping (supply-limited) units, then highstand clinoforms downlap onto the MFS.
# Facies: sand from the shoreline down to ~60 m water depth (grading to shale by ~115 m), shale below; mud on the landward plain; sand in the fans.
X=list(range(0,321,3)); FLOOR=172
sig=lambda z:1/(1+math.exp(-z))
def clino(xb,sl,fan=0):
    zt=sl+3; r=[]
    for x in X:
        top=zt+0.04*(x-xb)
        y=top+(FLOOR-top)*sig((x-xb-16)/8.5)
        if fan: y-=fan*math.exp(-((x-xb-58)/22)**2)
        r.append(min(y,FLOOR))
    return r
# (sea level, shelf break, systems tract, basin-floor fan height, max thickness: sediment-starved transgression)
steps=[(42,56,'HST',0,99),(41,72,'HST',0,99),(40,88,'HST',0,99),(39.5,104,'HST',0,99),
       (52,124,'FSST',0,99),(66,144,'FSST',0,99),(80,162,'FSST',10,99),(86,176,'LST',17,99),(84,188,'LST',8,99),
       (70,150,'TST',0,4),(55,120,'TST',0,4),(41,92,'TST',0,4),(30,70,'TST',0,4),(29,94,'HST',0,99),(28.5,118,'HST',0,99),(28,142,'HST',0,99)]
SAND,SHALE,WATER='#e3c46f','#a4a79b','#dbe5e8'
# moving sea level: the water body and sea-surface line translate in step with the deposits (CSS keyframes below);
# drawn under the sediments so emerged shelf hides them. Without animation they sit at the final highstand.
DT=.18   # seconds between deposition steps (whole sequence ~3.2 s)
tk=lambda k:round(.2+k*DT,2)
SL_END=steps[-1][0]; T6=lambda k:tk(k)+.3; DUR=T6(len(steps)-1)+.3
kf=[(0,44)]+[(T6(k),s[0]) for k,s in enumerate(steps)]
kf.append((DUR,SL_END))   # hold the final highstand (a missing 100% frame would snap back)
def keyframes(name,fn): return f'@keyframes {name}{{'+''.join(f'{t/DUR*100:.1f}%{{transform:{fn(k,s)}}}' for k,(t,s) in enumerate(kf))+'}'
b=f'<rect x="0" y="0" width="{W}" height="{H}" fill="{PAPER}"/><g class="a-sl6"><rect x="0" y="{SL_END}" width="{W}" height="{H}" fill="{WATER}"/><line x1="0" y1="{SL_END}" x2="{W}" y2="{SL_END}" stroke="{BLUE}" stroke-width="1.2" stroke-dasharray="5 3"/></g>'
S=[clino(40,44)]
b+=f'<path d="{path(list(zip(X,S[0])))} L320,200 L0,200Z" fill="{LINE}"/>'
defs='';body=''
for k,(sl,xb,tr,fan,cap) in enumerate(steps):
    if tr=='TST':   # transgressive shoreline sits where the rising sea meets the existing relief (onlap)
        wet=[x for x,y in zip(X,S[-1]) if y<=sl+3]
        if wet and wet[-1]<W-20: xb=wet[-1]+26
    new=[max(min(p,c),p-cap) for p,c in zip(S[-1],clino(xb,sl,fan))]
    S.append(new)
    # water-depth facies (vertical) + overlay for the muddy landward plain and the basin-floor fan (horizontal)
    defs+=f'<linearGradient id="g6v{k}" gradientUnits="userSpaceOnUse" x1="0" y1="{sl}" x2="0" y2="{sl+46}"><stop offset=".5" stop-color="{SAND}"/><stop offset="1" stop-color="{SHALE}"/></linearGradient>'
    ov=[(xb-75,SHALE,1),(xb-45,SHALE,0)]+([(xb+32,SAND,0),(xb+42,SAND,1),(xb+74,SAND,1),(xb+86,SAND,0)] if fan else [])
    defs+=f'<linearGradient id="g6h{k}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="{W}" y2="0">'+''.join(f'<stop offset="{max(0,min(1,x/W)):.3f}" stop-color="{c}" stop-opacity="{o}"/>' for x,c,o in ov)+'</linearGradient>'
    # keep only the x-range where this step actually deposited (the rest has zero thickness)
    on=[i for i in range(len(X)) if S[-2][i]-new[i]>.05]
    if not on: print("empty step",k,file=sys.stderr); on=[0]
    a,c=max(0,on[0]-1),min(len(X)-1,on[-1]+1)
    top=list(zip(X,new))[a:c+1]; poly=top+list(zip(X,S[-2]))[a:c+1][::-1]
    defs+=f'<path id="p6_{k}" d="{path(poly)}Z"/>'
    body+=f'<g{A("a-fade",tk(k))}><use href="#p6_{k}" fill="url(#g6v{k})"/><use href="#p6_{k}" fill="url(#g6h{k})"/><path d="{path(top)}" fill="none" stroke="{MUT}" stroke-width=".45"/></g>'
b+='<defs>'+defs+'</defs>'+body
# key surfaces: sequence boundary (top of the first highstand) and maximum flooding surface (top of the transgression)
# incised valley cut into the highstand shelf during the fall, filled with sand during the transgression
VC,VW,VD=78,15,9
vcut=lambda x,y:y+VD*max(0,1-((x-VC)/VW)**2)
sb=[(x,vcut(x,y)) for x,y in zip(X,S[4])]
vx=[(x,y) for x,y in sb if abs(x-VC)<=VW]
b+=f'<path d="{path(vx+[(x,y) for x,y in zip(X,S[4]) if abs(x-VC)<=VW][::-1])}Z" fill="{SAND}" stroke="{MUT}" stroke-width=".45"{A("a-fade",tk(10))}/>'
b+=f'<path d="{path(sb)}" fill="none" stroke="{GAS}" stroke-width="1.4"{A("a-fade",tk(4))}/>'+T(4,S[4][2]+11,'SB',9,GAS,weight=700,cls='a-fade',d=tk(4),extra=HALO)
b+=f'<path d="{path(list(zip(X,S[13])))}" fill="none" stroke="{BLUE}" stroke-width="1.4"{A("a-fade",tk(13))}/>'+T(4,S[13][2]-3,'MFS',9,BLUE,weight=700,cls='a-fade',d=tk(13),extra=HALO)
# systems-tract labels at the thickest point of each group
def lab(ks,name,col,d):
    th=[(sum(S[k][i]-S[k+1][i] for k in ks),i) for i in range(len(X))]; t,i=max(th)
    yt=(S[ks[0]][i]+S[ks[-1]+1][i])/2
    return T(X[i],yt+3.3,name,9,col,'middle',700,'a-fade',d,HALO)
b+=lab([0,1,2,3],'HST',FG,tk(3))+lab([4,5,6],'FSST',FG,tk(6))+lab([7,8],'LST',FG,tk(8))+lab([9,10,11,12],'TST',FG,tk(12))+lab([13,14,15],'HST',FG,tk(15))
# lowstand sea level for reference
b+=f'<line x1="150" y1="86" x2="{W}" y2="86" stroke="{BLUE}" stroke-width=".8" stroke-dasharray="2 2"{A("a-fade",tk(7))}/>'+T(314,83,'lowstand',8.5,BLUE,'end',cls='a-fade',d=tk(7))
# inset: relative sea-level curve, drawn step by step in sync with the deposits
ix0,ix1,iy0,iy1=228,310,40,64
slx=lambda k:ix0+k/(len(steps)-1)*(ix1-ix0); sly=lambda sl:iy0+(sl-28)/(86-28)*(iy1-iy0)
b+=f'<rect x="{ix0-26}" y="35" width="{ix1-ix0+32}" height="33" rx="3" fill="{PAPER}" stroke="{LINE}"/>'+T(ix0-22,49,'sea',8.5,MUT)+T(ix0-22,59,'level',8.5,MUT)
b+=f'<line x1="{ix0}" y1="{iy1+1}" x2="{ix1}" y2="{iy1+1}" stroke="{LT}" stroke-width=".6"/>'
for k in range(1,len(steps)):
    b+=f'<path d="M{f1(slx(k-1))},{f1(sly(steps[k-1][0]))} L{f1(slx(k))},{f1(sly(steps[k][0]))}" stroke="{BLUE}" stroke-width="1.6" stroke-linecap="round" pathLength="1"{A("a-draw",tk(k))}/>'
# inset marker riding the sea-level curve, plus the keyframes for both moving parts
b+=f'<circle cx="{f1(slx(len(steps)-1))}" cy="{f1(sly(SL_END))}" r="3" fill="{BLUE}" stroke="{PAPER}" class="a-sl6d"/>'
fx=lambda i:slx(min(len(steps)-1,max(0,i-1)))-slx(len(steps)-1)
b+=('<style>'+keyframes('xp-sl6',lambda i,s:f'translateY({s-SL_END:.1f}px)')+keyframes('xp-sl6d',lambda i,s:f'translate({fx(i):.1f}px,{sly(s)-sly(SL_END):.1f}px)')
    +f'.xp-js .xp-card svg .a-sl6{{transform:translateY({44-SL_END:.1f}px)}}.xp-js .xp-card svg .a-sl6d{{transform:translate({fx(0):.1f}px,{sly(44)-sly(SL_END):.1f}px)}}'
    +f'.xp-js .xp-card.in svg .a-sl6{{animation:xp-sl6 {DUR:.1f}s linear forwards}}.xp-js .xp-card.in svg .a-sl6d{{animation:xp-sl6d {DUR:.1f}s linear forwards}}</style>')
# legend + scale bars
b+=f'<g{A("a-fade",.1)}>'
for k,(c,l) in enumerate([(SAND,'sand'),(SHALE,'shale')]):
    b+=f'<rect x="{6+k*44}" y="8" width="9" height="9" fill="{c}" stroke="{MUT}" stroke-width=".4"/>'+T(18+k*44,16,l,9,FG)
b+='</g>'
b+=f'<line x1="10" y1="190" x2="70" y2="190" stroke="{FG}" stroke-width="2"/>'+T(76,193.5,'10 km',9,FG)
b+=f'<line x1="308" y1="176" x2="308" y2="196" stroke="{FG}" stroke-width="2"/>'+T(304,189,'50 m',9,FG,'end')+T(160,193.5,'VE ×50',9,MUT,'middle')
out.append(svg(b,'Forward stratigraphic model through one relative sea-level cycle: highstand progradation, falling-stage downstepping, lowstand fan and wedge, thin transgressive backstepping and highstand clinoforms downlapping onto the maximum flooding surface; shoreface sand passing into offshore shale'))

# ---------- 7. Geospatial ML: covariate layers + wells -> predicted property map ----------
b=marker('m7',CU)
# input covariate grids, drawn as stacked oblique layers
def layer(ox,oy,fn,cols,d):
    s=f'<g transform="translate({ox},{oy}) skewX(-35) scale(1,.5)"{A("a-fade",d)}>'
    for i in range(7):
        for j in range(6):
            v=fn(i/6,j/5); s+=f'<rect x="{i*10}" y="{j*10}" width="10" height="10" fill="{cols[min(len(cols)-1,int(v*len(cols)))]}" stroke="{PAPER}" stroke-width=".6"/>'
    return s+f'<rect x="0" y="0" width="70" height="60" fill="none" stroke="{MUT}" stroke-width=".8"/></g>'
fns=[(lambda u,v:.5+.45*math.sin(3*u+1)*math.cos(2*v),['#d8dde3','#a9b8c6','#6f8aa3','#3f5f7e'],'seismic attribute'),
     (lambda u,v:min(.99,.15+.8*(u*.6+v*.4)),['#efe6cf','#d9c38f','#b99a5a','#8a6a3a'],'depth'),
     (lambda u,v:.99 if (u-.3)**2+(v-.6)**2<.12 else .5 if u>.7 else .1,['#d7dccb','#a9b98f','#6f8a55'],'facies')]
for k,(fn,cols,lab) in enumerate(fns):
    y=40+k*44
    b+=layer(30,y,fn,cols,.1+k*.25)+T(8,y-5,lab,8.5,FG,weight=600,cls='a-fade',d=.1+k*.25)
b+=T(40,16,'covariates',9.5,LT,'middle')
b+=f'<path d="M98,104 L140,104" stroke="{CU}" stroke-width="1.8" pathLength="1" marker-end="url(#m7)"{A("a-draw",.9)}/>'+T(118,96,'ML',10.5,CU,'middle',700,'a-fade',.9)
# predicted property map (porosity), revealed diagonally; wells = training data
mx0,my0,cs,nx,ny=150,14,7,21,20
G=[(.25,.3,.18,1),(.7,.65,.22,.9),(.8,.2,.12,-.5),(.3,.85,.15,-.4)]
fld=lambda u,v:.45+sum(a*math.exp(-((u-gu)**2+(v-gv)**2)/(2*s*s)) for gu,gv,s,a in G)*.45
RAMP=['#f3ecd9','#e6d39f','#d4ae68','#bf8546','#a0602f','#6e3f22']
diag={}
for i in range(nx):
    for j in range(ny):
        v=max(0,min(.999,fld(i/(nx-1),j/(ny-1)))); c=RAMP[int(v*len(RAMP))]
        diag.setdefault(i+j,[]).append(f'<rect x="{mx0+i*cs}" y="{my0+j*cs}" width="{cs}" height="{cs}" fill="{c}"/>')
for dg in sorted(diag): b+=f'<g{A("a-fade",round(1.1+dg*.03,2))}>'+''.join(diag[dg])+'</g>'
b+=f'<rect x="{mx0}" y="{my0}" width="{nx*cs}" height="{ny*cs}" fill="none" stroke="{MUT}" stroke-width=".8"/>'+T(mx0+nx*cs/2,10,'predicted porosity',9.5,LT,'middle')
random.seed(11)
for k in range(11):
    u,v=random.uniform(.08,.92),random.uniform(.08,.92)
    b+=f'<circle cx="{f1(mx0+u*nx*cs)}" cy="{f1(my0+v*ny*cs)}" r="2.8" fill="{PAPER}" stroke="{FG}" stroke-width="1.1"{A("a-pop",.4+k*.05)}/>'
# colour bar, scale bar, north arrow
cy=my0+ny*cs+8
for k,c in enumerate(RAMP): b+=f'<rect x="{mx0+k*nx*cs/len(RAMP):.1f}" y="{cy}" width="{nx*cs/len(RAMP):.1f}" height="6" fill="{c}"/>'
b+=f'<rect x="{mx0}" y="{cy}" width="{nx*cs}" height="6" fill="none" stroke="{MUT}" stroke-width=".6"/>'
for k,l in enumerate(['5','10','15','20','25 %']): b+=T(mx0+k*nx*cs/4,cy+16,l,8.5,MUT,'middle' if k<4 else 'end')
b+=f'<g><rect x="{mx0+4}" y="{my0+ny*cs-15}" width="52" height="12" rx="2" fill="{PAPER}" fill-opacity=".9"/><line x1="{mx0+8}" y1="{my0+ny*cs-9}" x2="{mx0+33}" y2="{my0+ny*cs-9}" stroke="{FG}" stroke-width="2"/>'+T(mx0+36,my0+ny*cs-5.5,'5 km',8.5,FG)+'</g>'
b+=f'<g transform="translate({mx0+nx*cs-11},{my0+12})"><circle r="9" fill="{PAPER}" fill-opacity=".9"/><path d="M0,-6.5 L3.2,4 L0,1.6 L-3.2,4Z" fill="{FG}"/></g>'+T(mx0+nx*cs-11,my0+30,'N',8,FG,'middle',700)
b+=f'<g{A("a-fade",.3)}><circle cx="10" cy="190" r="2.8" fill="{PAPER}" stroke="{FG}" stroke-width="1.1"/>'+T(17,193,'wells (training data)',8.5,FG)+'</g>'
out.append(svg(b,'Geospatial machine learning: covariate layers and well data combined to predict a property map, here porosity, with colour scale, scale bar and north arrow'))

# ---------- 8. Knowledge graph ----------
b=''
for i,(x,y) in enumerate([(16,40),(16,90),(16,140)]):
    b+=f'<g{A("a-fade",i*.15)}><rect x="{x}" y="{y}" width="32" height="40" rx="2" fill="{PAPER}" stroke="{MUT}"/>'
    for k in range(4): b+=f'<line x1="{x+6}" y1="{y+10+k*6}" x2="{x+26-(k%2)*7}" y2="{y+10+k*6}" stroke="{LT}" stroke-width="1.3"/>'
    b+='</g>'
b+=T(32,194,'reports',9.5,LT,'middle')
b+=marker('m8',CU)+f'<path d="M58,110 L94,110" stroke="{CU}" stroke-width="1.8" pathLength="1" marker-end="url(#m8)"{A("a-draw",.5)}/>'+T(76,102,'LLM',10,CU,'middle',700,'a-fade',.5)
# node colour = entity type (legend); edges carry the relation names
N={'Basin':(150,56,GRN),'Formation':(206,44,GRN),'Seal':(220,104,GRN),'Source rock':(282,104,GRN),'Well A-1':(132,124,BLUE),'TOC 4.2 %':(228,158,CU),'Report 2019':(148,166,MUT)}
E=[('Basin','Formation',''),('Basin','Well A-1',''),('Formation','Seal',''),('Formation','Source rock',''),('Seal','Source rock','overlies'),('Well A-1','Seal',''),
   ('Well A-1','TOC 4.2 %','measured'),('TOC 4.2 %','Source rock','characterises'),('Report 2019','Well A-1','describes'),('Report 2019','TOC 4.2 %','cites')]
for k,(a,c,_) in enumerate(E): b+=f'<path d="M{N[a][0]},{N[a][1]} L{N[c][0]},{N[c][1]}" stroke="{LINE}" stroke-width="1.5" pathLength="1"{A("a-draw",1+k*.08)}/>'
# answer path for the query: report -> well -> measurement -> source rock (evidence with its source)
q=['Report 2019','Well A-1','TOC 4.2 %','Source rock']
b+=f'<path d="{path([N[n][:2] for n in q])}" fill="none" stroke="{CU}" stroke-width="2.2"{A("a-flow",2.4)}/>'
for k,(n,(x,y,col)) in enumerate(N.items()):
    b+=f'<circle cx="{x}" cy="{y}" r="7.5" fill="{col}" stroke="{PAPER}" stroke-width="1.5"{A("a-pop",.8+k*.1)}/>'+T(x,y-12 if y<150 else y+20,n,10,FG,'middle',cls='a-fade',d=.9+k*.1)
for (a,c,rel),(dx,dy_,anc) in zip([e for e in E if e[2]],[(0,12,'middle'),(-4,-4,'middle'),(6,0,'start'),(-5,2,'end'),(0,12,'middle')]):
    mx,my=(N[a][0]+N[c][0])/2,(N[a][1]+N[c][1])/2
    b+=T(mx+dx,my+dy_,rel,8,MUT,anc,cls='a-fade',d=1.9,extra=' font-style="italic"'+HALO)
b+=f'<g{A("a-fade",2.2)}><rect x="244" y="18" width="73" height="30" rx="3" fill="{PAPER}" stroke="{CU}"/>'+T(249,30,'Q: source rock',8.5,CU,weight=700)+T(249,42,'proven?',8.5,CU,weight=700)+'</g>'
b+=f'<g{A("a-fade",.2)}>'
for k,(col,l,x) in enumerate([(GRN,'geology',62),(BLUE,'well',118),(CU,'measurement',154),(MUT,'report',226)]):
    b+=f'<circle cx="{x}" cy="11" r="3.5" fill="{col}"/>'+T(x+6,14,l,8.5,MUT)
b+='</g>'
out.append(svg(b,'Knowledge graph built from reports by an LLM: entities linked by named relations, and the evidence path answering a question about the source rock'))
import re
# elements whose opacity is animated keep their transparency as fill-opacity
out=[re.sub(r'(<(?:rect|path)[^>]*?) opacity="([^"]+)"([^>]*class="a-fade")',r'\1 fill-opacity="\2"\3',o) for o in out]
open(sys.argv[1],'w').write('\n'.join(out)); print(len(out))
