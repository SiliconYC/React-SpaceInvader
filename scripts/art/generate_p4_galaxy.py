#!/usr/bin/env python3
"""P4 original algorithmic nebula painting: directed brush filaments, dust lanes,
stellar knots and volumetric soft light. No stock assets, external URLs or noise-only
gradients. Generated PNG is the editing master; WebP is the actual runtime texture.
Deterministic seed = 7717 + variant. Requires Pillow + NumPy offline only.
"""
from pathlib import Path
from math import sin,cos,pi,exp
import numpy as np
from PIL import Image,ImageDraw,ImageFilter

W,H=1600,900
OUT=Path("public/art/backgrounds")

def glow_layer(base,marks,blur):
    paint=Image.new("RGBA",(W,H),(0,0,0,0))
    pen=ImageDraw.Draw(paint,"RGBA")
    marks(pen)
    if blur: paint=paint.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(base,paint)

def route(t,variant,arm):
    # Artwork composition: structured clouds at the frame edges, clear fight center.
    if variant=="veil":
        if arm==0:return (W*(.03+.56*t),H*(.08+.26*t+.05*sin(t*7)))
        if arm==1:return (W*(.91-.47*t),H*(.94-.30*t-.07*sin(t*6)))
        return (W*(.09+.26*t),H*(.97-.60*t+.045*sin(t*9)))
    if arm==0:return (W*(.01+.42*t),H*(.78-.52*t+.09*sin(t*8)))
    if arm==1:return (W*(.99-.43*t),H*(.18+.48*t-.06*sin(t*9)))
    return (W*(.62+.34*t),H*(.99-.58*t+.04*sin(t*7)))

def draw(variant):
    rng=np.random.default_rng(7717+(0 if variant=="veil" else 23))
    backdrop=Image.new("RGBA",(W,H),(3,9,24,255))
    palette=([(42,47,116),(31,84,122),(89,43,127),(78,69,148)] if variant=="veil"
             else [(26,85,136),(62,48,141),(104,47,122),(50,97,126)])
    # Wide clouds are laid down with hundreds of translucent handmade dab shapes,
    # not an interpolated noise texture. Curved orbital ribbons guide the composition.
    for layer in range(4):
        color=palette[layer]
        def cloud(pen):
            for arm in range(3):
                for _ in range(320):
                    t=float(rng.uniform(.02,.98))
                    x,y=route(t,variant,arm)
                    x+=rng.normal(0,56+27*layer)
                    y+=rng.normal(0,35+22*layer)
                    a=float(rng.uniform(12,72))
                    radius=float(rng.uniform(24,95))*(1.25 if layer==0 else .85)
                    pen.ellipse((x-radius*1.5,y-radius*.6,x+radius*1.5,y+radius*.6),
                                fill=(*color,int(a)))
        backdrop=glow_layer(backdrop,cloud,28+layer*7)
    # Luminous ridges and branching tendrils, drawn as many real strokes.
    for layer in range(3):
        def filaments(pen):
            for arm in range(3):
                for strand in range(24):
                    phase=float(rng.uniform(-1.0,1.0))
                    band=float(rng.normal(0,24+9*layer))
                    path=[]
                    for t in np.linspace(.08,.94,84):
                        x,y=route(float(t),variant,arm)
                        jitter=sin(float(t)*14+phase*6)*float(7+layer*6)
                        path.append((round(x+band*.7+jitter),round(y+band+jitter*.48)))
                    c=palette[(arm+layer)%len(palette)]
                    col=tuple(min(255,int(v*1.36)) for v in c)
                    pen.line(path,fill=(*col,int(5+5*(3-layer))),width=(17 if layer==0 else 5 if layer==1 else 2))
        backdrop=glow_layer(backdrop,filaments,13 if layer==0 else 5 if layer==1 else 1)
    # Dark gas lanes visibly interrupt lit clouds and supply depth.
    def dust(pen):
        for arm in range(3):
            for strand in range(15):
                o=float(rng.normal(0,14))
                path=[]
                for t in np.linspace(.10,.92,64):
                    x,y=route(float(t),variant,arm)
                    path.append((int(x+o+11*sin(float(t)*9+strand)),
                                 int(y+o+8*cos(float(t)*7+strand))))
                pen.line(path,fill=(3,7,20,28),width=int(rng.uniform(7,23)))
    backdrop=glow_layer(backdrop,dust,8)
    # Apply a central contrast-preservation envelope ONLY to the nebula.
    image=np.asarray(backdrop.convert("RGB"),dtype=np.float32)
    yy,xx=np.mgrid[0:H,0:W]
    keep=1-.76*np.exp(-(((xx/W-.50)/.29)**2+((yy/H-.51)/.34)**2))
    base=np.array([3,9,24],dtype=np.float32)
    image=base+(image-base)*keep[:,:,None]
    image=np.uint8(np.clip(image,0,255))
    result=Image.fromarray(image,"RGB").convert("RGBA")
    # Star points: varying temperature, tiny physically-shaped halos, bright ones rare.
    star_glows=Image.new("RGBA",(W,H),(0,0,0,0))
    glow=ImageDraw.Draw(star_glows,"RGBA")
    sharp=Image.new("RGBA",(W,H),(0,0,0,0))
    tip=ImageDraw.Draw(sharp,"RGBA")
    for _ in range(1350):
        x=int(rng.integers(0,W));y=int(rng.integers(0,H))
        # Avoid the fighting plane; central stars mostly a barely visible dusting.
        center=exp(-(((x/W-.5)/.31)**2+((y/H-.5)/.32)**2))
        if rng.random()<.77*center:continue
        size=float(rng.choice([.45,.6,.9,1.2,1.8,2.4],p=[.22,.27,.24,.16,.09,.02]))
        color=tuple(int(v) for v in rng.choice(
            [[157,194,237],[202,207,249],[135,177,222],[239,218,220]]))
        strength=int(rng.integers(35,130))
        glow.ellipse((x-3*size,y-3*size,x+3*size,y+3*size),
                     fill=(*color,int(strength*.21)))
        tip.ellipse((x-size*.5,y-size*.5,x+size*.5,y+size*.5),
                    fill=(*color,strength))
    result=Image.alpha_composite(result,star_glows.filter(ImageFilter.GaussianBlur(5)))
    result=Image.alpha_composite(result,sharp)
    return result.convert("RGB")

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    for name in ("veil","arc"):
        img=draw(name)
        source=OUT/("galaxy-p4-"+name+"-source.png")
        runtime=OUT/("galaxy-p4-"+name+".webp")
        img.save(source,optimize=True)
        img.save(runtime,"WEBP",quality=81,method=6)
        print(name,source.stat().st_size,runtime.stat().st_size)
if __name__=="__main__":main()
