"""Generate the 8 animated SVG diagrams of the home-page Expertise carousel.

Usage:  python scripts/expertise_svgs.py out.txt   -> one <svg> per line, in card order.
Paste each line into the matching <div class="xp-img"> in docs/index.md.
Animation classes (a-draw, a-fade, a-pop, a-rise, a-down, a-flow, delay via --d)
are defined in docs/stylesheets/extra.css and triggered by docs/javascripts/expertise.js.
"""
import math,sys,random
FG,MUT,LT,LINE,ACC,CU,GRN,BLUE,PAPER='#232220','#5c5a52','#8a8778','#c9c4b6','#4a5a4e','#a8623a','#4f6b3c','#4a6f8f','#f5f3ed'
W,H=320,200
def f1(v): return f'{v:.1f}'
def path(pts): return 'M'+' L'.join(f'{f1(x)},{f1(y)}' for x,y in pts)
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

# ---------- 1. Petroleum system cross-section ----------
X=list(range(30,321,4))
def h(x,y0,A=30): return y0-A*math.exp(-((x-222)/50)**2)+0.12*(222-x)
ys=[58,80,96,124,140]
fills=['#ece9df','#cfd3c8','#e6d6b0','#d9d5c8','#4f4d47','#c9c4b6']
top=[(x,14) for x in X]; bot=[(x,186) for x in X]
L=[top]+[[(x,h(x,y)) for x in X] for y in ys]+[bot]
b=marker('m1',CU)+'<clipPath id="xc1"><rect x="30" y="14" width="290" height="172"/></clipPath><g clip-path="url(#xc1)">'
for i in range(len(L)-1): b+=f'<path d="{path(L[i]+L[i+1][::-1])}Z" fill="{fills[i]}"/>'
for i in range(1,len(L)-1): b+=f'<path d="{path(L[i])}" fill="none" stroke="{MUT}" stroke-width=".6"/>'
res=[(x,h(x,ys[1])) for x in X]+[(x,h(x,ys[2])) for x in X][::-1]
crest=min(h(x,ys[1]) for x in X); owc=crest+14
b+=f'<clipPath id="xc1b"><path d="{path(res)}Z"/></clipPath><g clip-path="url(#xc1b)"><rect x="30" y="{f1(crest-2)}" width="290" height="{f1(owc-crest+2)}" fill="{CU}"{A("a-down",1.6)}/></g>'
# expulsion + carrier-bed migration along reservoir mid-line
mid=lambda x:(h(x,ys[1])+h(x,ys[2]))/2
for sx in (60,110):
    b+=f'<path d="M{sx},{f1(h(sx,ys[3])-1)} L{sx},{f1(mid(sx)+3)}" stroke="{CU}" stroke-width="1.6" fill="none"{A("a-flow",.3)}/>'
mig=[(x,mid(x)) for x in range(50,214,4)]
b+=f'<path d="{path(mig)}" stroke="{CU}" stroke-width="1.8" fill="none" marker-end="url(#m1)"{A("a-flow",.6)}/>'
b+='</g>'
# depth axis + scale bar
dz=lambda km:14+km*40
b+=f'<line x1="30" y1="14" x2="30" y2="186" stroke="{FG}" stroke-width=".9"/>'
for km in range(0,5): b+=f'<line x1="27" y1="{dz(km)}" x2="30" y2="{dz(km)}" stroke="{FG}" stroke-width=".9"/>'+T(25,dz(km)+3.3,str(km),9.5,MUT,'end')
b+=f'<text x="9" y="100" font-size="9.5" fill="{LT}" text-anchor="middle" transform="rotate(-90 9 100)">depth (km)</text>'
b+=f'<rect x="242" y="170" width="70" height="13" rx="2" fill="{PAPER}" opacity=".9"/><line x1="248" y1="178" x2="288" y2="178" stroke="{FG}" stroke-width="2"/>'+T(292,181.5,'10 km',9,FG)
b+=T(36,h(36,ys[0])+14,'seal',10,FG)+T(36,h(36,ys[1])+12.5,'reservoir',10,FG)+T(36,h(36,ys[3])+12,'source rock',10,PAPER)
b+=T(238,crest-8,'trap',11,CU,weight=700,cls='a-fade',d=2.4)+T(150,h(150,ys[4])+13,'kitchen',10,PAPER,cls='a-fade',d=.2)
out.append(svg(b,'Cross-section of a petroleum system: expulsion from the source rock, migration along the carrier bed and filling of an anticlinal trap'))

# ---------- 2. Burial history ----------
x0,x1,y0,y1=40,310,30,190
ax=lambda a:x0+(150-a)/150*(x1-x0); ay=lambda d:y0+d/5*(y1-y0)
b=frame(x0,x1,y0,y1,[(ax(a),str(a)) for a in (150,100,50,0)],[(ay(d),str(d)) for d in range(6)],'age (Ma)','depth (km)',xtop=True,grid=False)
b+=f'<rect x="{x0}" y="{f1(ay(2.7))}" width="{x1-x0}" height="{f1(ay(4.3)-ay(2.7))}" fill="{CU}" opacity=".2"{A("a-fade",1.8)}/>'
b+=f'<rect x="{x0}" y="{f1(ay(4.3))}" width="{x1-x0}" height="{f1(y1-ay(4.3))}" fill="{BLUE}" opacity=".14"{A("a-fade",1.9)}/>'
Hs=[(150,4.7),(118,3.8),(92,3.0),(66,2.15),(40,1.3),(16,.55)]
curves=[[(ax(t),ay(D*((Aa-t)/Aa)**.72)) for t in [Aa-i*Aa/40 for i in range(41)]] for Aa,D in Hs]
tones=['#d9d5c8','#e6d6b0','#cfd3c8','#e6d6b0','#d9d5c8','#e6d6b0']
for i,c in enumerate(curves):
    nxt=curves[i+1] if i+1<len(curves) else [(x1,y0)]
    poly=c+([(x1,ay(Hs[i+1][1]))] if i+1<len(curves) else [])+nxt[::-1]
    b+=f'<path d="{path(poly)}Z" fill="{tones[i]}" opacity=".85"{A("a-fade",.4+i*.22)}/>'
for i,c in enumerate(curves): b+=f'<path d="{path(c)}" fill="none" stroke="{MUT}" stroke-width=".9" pathLength="1"{A("a-draw",i*.22)}/>'
b+=f'<line x1="{x0}" y1="{y0}" x2="{x1}" y2="{y0}" stroke="{FG}" stroke-width=".9"/>'
b+=T(x1-4,ay(2.7)+13,'oil window',10.5,CU,'end',700,'a-fade',2.1)+T(x1-4,ay(4.3)+13,'gas',10,BLUE,'end',600,'a-fade',2.2)
out.append(svg(b,'Burial history: sediment layers subsiding through the oil and gas windows over 150 million years'))

# ---------- 3. HI vs Tmax with maturity (vitrinite) zones ----------
x0,x1,y0,y1=42,306,34,166
tx=lambda t:x0+(t-400)/100*(x1-x0); hy=lambda v:y1-v/1000*(y1-y0)
b=''
zones=[(400,435,'#ece9df','immature'),(435,445,'#dfe6cf',''),(445,450,'#c9d8b4',''),(450,470,'#dfe6cf',''),(470,500,'#d8e0e6','gas')]
for i,(a,c,col,lab) in enumerate(zones): b+=f'<rect x="{f1(tx(a))}" y="{y0}" width="{f1(tx(c)-tx(a))}" height="{y1-y0}" fill="{col}"{A("a-fade",i*.12)}/>'
b+=T((tx(445)+tx(470))/2+6,y0+13,'oil window',10,GRN,'middle',700,'a-fade',.6)
b+=T((tx(400)+tx(435))/2,y1-7,'immature',9.5,MUT,'middle',600,'a-fade',.6)+T((tx(470)+tx(500))/2,y0+13,'gas',9.5,BLUE,'middle',700,'a-fade',.6)
b+=frame(x0,x1,y0,y1,[(tx(t),str(t)) for t in (400,425,450,475,500)],[(hy(v),str(v)) for v in (0,250,500,750,1000)],'Tmax (°C)','HI (mg HC/g TOC)')
# vitrinite reflectance scale on top
for t,ro in [(435,'0.6'),(450,'1.0'),(470,'1.35')]:
    b+=f'<line x1="{f1(tx(t))}" y1="{y0}" x2="{f1(tx(t))}" y2="{y0-3}" stroke="{FG}" stroke-width=".9"/>'+T(tx(t),y0-5,ro,9,MUT,'middle')
b+=f'<line x1="{x0}" y1="{y0}" x2="{x1}" y2="{y0}" stroke="{FG}" stroke-width=".9"/>'+T(x1,y0-5,'%Ro',9,LT,'end')
for name,H0,Tm,w,col,lx in [('I',900,447,3.2,GRN,421),('II',640,452,6.5,ACC,421),('III',270,462,11,CU,421)]:
    pts=[(tx(t),hy(H0/(1+math.exp((t-Tm)/w)))) for t in [404+i*0.8 for i in range(120)]]
    b+=f'<path d="{path(pts)}" fill="none" stroke="{col}" stroke-width="1.8" pathLength="1"{A("a-draw",.7)}/>'
    b+=T(tx(lx),hy(H0)-5,'Type '+name,10,col,weight=700,cls='a-fade',d=1.6)
random.seed(3)
pts=[]
for k in range(24):
    t=random.uniform(424,468); v=640/(1+math.exp((t-452)/6.5))*random.uniform(.8,1.15)
    pts.append((t,v))
for k,(t,v) in enumerate(sorted(pts)):
    b+=f'<circle cx="{f1(tx(t))}" cy="{f1(hy(v))}" r="3" fill="{ACC}" fill-opacity=".75" stroke="{FG}" stroke-width=".5"{A("a-pop",1.9+k*.06)}/>'
out.append(svg(b,'Hydrogen index against Tmax with kerogen type curves and maturity zones from vitrinite reflectance'))

# ---------- 4. Pressure-depth ----------
x0,x1,y0,y1=40,310,30,190
px=lambda p:x0+p/120*(x1-x0); dy=lambda d:y0+d/5*(y1-y0)
b=frame(x0,x1,y0,y1,[(px(p),str(p)) for p in (0,30,60,90,120)],[(dy(d),str(d)) for d in range(6)],'pressure (MPa)','depth (km)',xtop=True)
ds=2.4
b+=f'<rect x="{x0}" y="{f1(dy(ds)-6)}" width="{x1-x0}" height="6" fill="{MUT}" opacity=".35"{A("a-fade",.2)}/>'+T(x1-3,dy(ds)-9,'seal',9.5,MUT,'end',cls='a-fade',d=.2)
pp=[]
for i in range(81):
    d=i*5/80
    p=10*d if d<=ds else 10*d+(1-math.exp(-(d-ds)/0.9))*(20.5*d-10*d)
    pp.append((px(p),dy(d)))
over=[q for q in pp if q[1]>=dy(ds)]
b+=f'<path d="{path(over+[(px(10*((y-y0)/(y1-y0)*5)),y) for x,y in over][::-1])}Z" fill="{CU}" opacity=".2"{A("a-fade",1.6)}/>'
b+=f'<path d="M{px(0)},{dy(0)} L{f1(px(50))},{dy(5)}" stroke="{BLUE}" stroke-width="1.5" pathLength="1"{A("a-draw",.1)}/>'
b+=f'<path d="M{px(0)},{dy(0)} L{f1(px(115))},{dy(5)}" stroke="{MUT}" stroke-width="1.5" pathLength="1"{A("a-draw",.1)}/>'
b+=f'<path d="{path(pp)}" fill="none" stroke="{CU}" stroke-width="2.2" pathLength="1"{A("a-draw",.6)}/>'
b+=T(px(57),dy(4.75),'overpressure',10.5,CU,'middle',700,'a-fade',2)
b+=f'<g{A("a-fade",.3)}><rect x="214" y="38" width="92" height="46" rx="3" fill="{PAPER}" stroke="{LINE}"/>'
for k,(col,lab) in enumerate([(BLUE,'hydrostatic'),(MUT,'lithostatic'),(CU,'pore pressure')]): b+=f'<line x1="220" y1="{49+k*13}" x2="234" y2="{49+k*13}" stroke="{col}" stroke-width="2"/>'+T(239,52.5+k*13,lab,9.5,FG)
b+='</g>'
out.append(svg(b,'Pressure against depth: pore pressure departing from hydrostatic below a seal, toward lithostatic'))

# ---------- 5. Prospect evaluation ----------
x0,x1,y0,y1=42,310,16,166
lx=lambda v:x0+math.log10(v)/3*(x1-x0); py=lambda p:y1-p*(y1-y0)
mu,sg=math.log(50),1.0; Phi=lambda z:.5*(1+math.erf(z/math.sqrt(2)))
b=frame(x0,x1,y0,y1,[(lx(v),str(v)) for v in (1,10,100,1000)],[(py(p),f'{int(p*100)}') for p in (0,.25,.5,.75,1)],'recoverable volume (MMbbl, log)','exceedance (%)')
for i in range(30):
    a,c=i*3/30,(i+1)*3/30; vm=10**((a+c)/2); d=math.exp(-((math.log(vm)-mu)/sg)**2/2)
    if d<.02: continue
    b+=f'<rect x="{f1(lx(10**a)+.7)}" y="{f1(y1-d*80)}" width="{f1(lx(10**c)-lx(10**a)-1.4)}" height="{f1(d*80)}" fill="{LINE}"{A("a-rise",i*.03)}/>'
cur=[(lx(10**(i*3/120)),py(1-Phi((math.log(10**(i*3/120))-mu)/sg))) for i in range(121)]
b+=f'<path d="{path(cur)}" fill="none" stroke="{ACC}" stroke-width="2.2" pathLength="1"{A("a-draw",.9)}/>'
for k,(lab,p,z) in enumerate([('P90',.9,-1.2816),('P50',.5,0),('P10',.1,1.2816)]):
    v=math.exp(mu+z*sg);X_,Y_=lx(v),py(p);dd=2.1+k*.25
    b+=f'<g{A("a-fade",dd)}><line x1="{f1(X_)}" y1="{f1(Y_)}" x2="{f1(X_)}" y2="{y1}" stroke="{CU}" stroke-dasharray="3 2"/><circle cx="{f1(X_)}" cy="{f1(Y_)}" r="3.5" fill="{CU}"/></g>'+T(X_+6,Y_-5,f'{lab} · {v:.0f}',10,CU,weight=700,cls='a-fade',d=dd)
b+=f'<g{A("a-fade",3)}><rect x="236" y="26" width="66" height="24" rx="3" fill="{PAPER}" stroke="{ACC}"/></g>'+T(269,42,'POS 32 %',10.5,ACC,'middle',700,'a-fade',3)
out.append(svg(b,'Volume distribution and exceedance curve with P90, P50 and P10 and the probability of success'))

# ---------- 6. Clinoforms (forward stratigraphic model) ----------
X=list(range(0,321,4))
b=f'<rect x="0" y="0" width="{W}" height="{H}" fill="#dfe6e6"/>'
sea=40
b+=f'<line x1="0" y1="{sea}" x2="{W}" y2="{sea}" stroke="{BLUE}" stroke-width="1" stroke-dasharray="5 3"/>'+T(314,sea-5,'sea level',9.5,BLUE,'end')
def surf(k):
    xb=40+30*k; tp=sea+16-1.7*k
    return [(x,tp+(168-tp)/(1+math.exp(-(x-xb-20)/10))) for x in X]
S=[[(x,176) for x in X]]+[surf(k) for k in range(8)]
cols=['#d9d5c8','#e6d6b0']*4
for k in range(1,len(S)):
    b+=f'<g{A("a-fade",.2+k*.32)}><path d="{path(S[k]+S[k-1][::-1])}Z" fill="{cols[k-1]}"/><path d="{path(S[k])}" fill="none" stroke="{MUT}" stroke-width=".7"/></g>'
b+=f'<rect x="0" y="176" width="{W}" height="24" fill="{LINE}"/>'
b+=marker('m6',CU)+f'<path d="M14,{sea-14} L84,{sea-14}" stroke="{CU}" stroke-width="1.6" pathLength="1" marker-end="url(#m6)"{A("a-draw",.2)}/>'+T(90,sea-10.5,'progradation',10,CU,weight=600)
b+=T(10,sea+32,'shelf',10.5,FG,weight=700)+T(214,128,'slope',10.5,FG,weight=700)+T(310,170,'basin',10,FG,'end',700)
# scale bars
b+=f'<line x1="14" y1="190" x2="74" y2="190" stroke="{FG}" stroke-width="2"/>'+T(80,193.5,'10 km',9.5,FG)
b+=f'<line x1="300" y1="{sea}" x2="300" y2="{sea+40}" stroke="{FG}" stroke-width="2"/>'+T(296,sea+24,'100 m',9.5,FG,'end')
out.append(svg(b,'Forward stratigraphic model: clinoforms prograding from shelf to basin'))

# ---------- 7. CCUS screening map ----------
b=f'<rect x="0" y="0" width="{W}" height="{H}" fill="{PAPER}"/>'
G=[(95,85,50,1.0),(215,118,55,.92),(150,40,38,-.5),(265,48,32,.5)]
fz=lambda x,y:sum(a*math.exp(-((x-gx)**2+(y-gy)**2)/(2*s*s)) for gx,gy,s,a in G)
cs=12.5
for i in range(25):
    for j in range(16):
        x,y=i*cs+cs/2+2,j*cs+cs/2; v=fz(x,y)
        col='#ece9df' if v<.25 else '#cfd3c8' if v<.5 else '#9fae9c' if v<.72 else CU
        b+=f'<rect x="{f1(i*cs+2)}" y="{f1(j*cs)}" width="{cs-1.2}" height="{cs-1.2}" fill="{col}"{A("a-fade",round((i+j)*.045,2))}/>'
random.seed(7)
for k in range(12):
    x,y=random.uniform(15,190),random.uniform(12,150)
    b+=f'<circle cx="{f1(x)}" cy="{f1(y)}" r="2.6" fill="{FG}"{A("a-pop",1.9+k*.06)}/>'
b+=f'<g{A("a-fade",.1)}><rect x="200" y="132" width="114" height="62" rx="3" fill="{PAPER}" opacity=".95" stroke="{LINE}"/>'
for k,(col,lab) in enumerate([(CU,'storage fairway'),('#9fae9c','high'),('#cfd3c8','medium')]):
    b+=f'<rect x="207" y="{139+k*13}" width="9" height="9" fill="{col}"/>'+T(221,147+k*13,lab,9.5,FG)
b+=f'<circle cx="211.5" cy="{143.5+3*13}" r="2.6" fill="{FG}"/>'+T(221,147+3*13,'wells',9.5,FG)+'</g>'
b+=f'<rect x="8" y="172" width="84" height="22" rx="2" fill="{PAPER}" opacity=".9"/><line x1="14" y1="186" x2="64" y2="186" stroke="{FG}" stroke-width="2"/><line x1="14" y1="183" x2="14" y2="189" stroke="{FG}"/><line x1="64" y1="183" x2="64" y2="189" stroke="{FG}"/>'+T(68,189.5,'25 km',9.5,FG)
b+=f'<g transform="translate(300,22)"><circle r="11" fill="{PAPER}" opacity=".9"/><path d="M0,-8 L4,5 L0,2 L-4,5Z" fill="{FG}"/>'+T(0,-12.5,'N',9,FG,'middle',700)+'</g>'
out.append(svg(b,'Map of CO2 storage suitability from geospatial machine learning, with a storage fairway and wells'))

# ---------- 8. Knowledge graph ----------
b=''
for i,(x,y) in enumerate([(16,34),(16,86),(16,138)]):
    b+=f'<g{A("a-fade",i*.15)}><rect x="{x}" y="{y}" width="32" height="40" rx="2" fill="{PAPER}" stroke="{MUT}"/>'
    for k in range(4): b+=f'<line x1="{x+6}" y1="{y+10+k*6}" x2="{x+26-(k%2)*7}" y2="{y+10+k*6}" stroke="{LT}" stroke-width="1.3"/>'
    b+='</g>'
b+=T(32,192,'reports',9.5,LT,'middle')
b+=marker('m8',CU)+f'<path d="M58,106 L94,106" stroke="{CU}" stroke-width="1.8" pathLength="1" marker-end="url(#m8)"{A("a-draw",.5)}/>'+T(76,98,'LLM',10,CU,'middle',700,'a-fade',.5)
N={'Basin':(148,48,ACC),'Formation':(222,34,GRN),'Source rock':(276,96,CU),'Well A-1':(132,126,BLUE),'TOC 4.2 %':(214,160,CU),'Report 2019':(140,178,MUT),'Seal':(222,100,GRN)}
E=[('Basin','Formation'),('Formation','Source rock'),('Formation','Seal'),('Basin','Well A-1'),('Well A-1','Seal'),('Well A-1','TOC 4.2 %'),('TOC 4.2 %','Source rock'),('Report 2019','Well A-1'),('Report 2019','TOC 4.2 %'),('Basin','Seal')]
for k,(a,c) in enumerate(E): b+=f'<path d="M{N[a][0]},{N[a][1]} L{N[c][0]},{N[c][1]}" stroke="{LINE}" stroke-width="1.5" pathLength="1"{A("a-draw",1+k*.08)}/>'
for k,(n,(x,y,col)) in enumerate(N.items()):
    b+=f'<circle cx="{x}" cy="{y}" r="7.5" fill="{col}" stroke="{PAPER}" stroke-width="1.5"{A("a-pop",.8+k*.1)}/>'+T(x,y-12 if y<150 else y+20,n,10,FG,'middle',cls='a-fade',d=.9+k*.1)
b+=f'<path d="M{N["Report 2019"][0]},{N["Report 2019"][1]} L{N["Well A-1"][0]},{N["Well A-1"][1]} L{N["Seal"][0]},{N["Seal"][1]} L{N["Formation"][0]},{N["Formation"][1]} L{N["Source rock"][0]},{N["Source rock"][1]}" fill="none" stroke="{CU}" stroke-width="2"{A("a-flow",2.2)}/>'
out.append(svg(b,'Knowledge graph built from reports by an LLM, linking basins, wells, formations and source rocks'))
import re
# elements whose opacity is animated keep their transparency as fill-opacity
out=[re.sub(r'(<(?:rect|path)[^>]*?) opacity="([^"]+)"([^>]*class="a-fade")',r'\1 fill-opacity="\2"\3',o) for o in out]
open(sys.argv[1],'w').write('\n'.join(out)); print(len(out))
