#!/usr/bin/env python3
"""Reproducible original P3 nebula artwork (Pillow + NumPy), zero external reference imagery."""
import argparse
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
W,H=1600,900
def noise(rng,w,h,scale):
  low=Image.fromarray(rng.integers(0,256,(max(2,int(h/scale)),max(2,int(w/scale))),dtype=np.uint8),'L')
  return np.asarray(low.resize((w,h),Image.Resampling.BICUBIC),dtype=np.float32)/255
def draw(variant):
  rng=np.random.default_rng(4270+variant)
  yy,xx=np.mgrid[0:H,0:W].astype(np.float32); nx=xx/W;ny=yy/H
  turbulence=sum(noise(rng,W,H,s)*coef for s,coef in [(390,.48),(190,.25),(85,.14),(38,.08),(17,.05)])
  bands=ny-(.15+.48*nx+.075*np.sin(nx*9+variant*.3))
  falloff=np.exp(-(bands/.21)**2)
  side=np.exp(-((nx-.17)/.31)**2)+np.exp(-((nx-.85)/.34)**2)
  envelope=falloff*(.34+.36*side)
  cloudy=np.clip((turbulence-.36)*2.4,0,1)*envelope
  exclusion=1-.72*np.exp(-((nx-.5)/.26)**2-((ny-.48)/.32)**2)
  cloudy*=exclusion
  aurora=.13*np.exp(-((nx-.17)/.23)**2-((ny-.28)/.22)**2)+.16*np.exp(-((nx-.83)/.22)**2-((ny-.67)/.24)**2)
  if variant==1:
    palette=np.array([3.4,8.1,24.0],np.float32)
    tint=np.array([37,23,75],np.float32)
    cloud=cloudy*.63; ambience=aurora*.42
  else:
    palette=np.array([4.5,11,30],np.float32)
    tint=np.array([54,32,85],np.float32)
    cloud=cloudy*.95; ambience=aurora*.54
  im=np.zeros((H,W,3),dtype=np.float32)
  for i in range(3):im[:,:,i]=palette[i]+cloud*tint[i]+ambience*np.array([14,22,45])[i]
  base=Image.fromarray(np.uint8(np.clip(im,0,255)),'RGB')
  glow=Image.new('RGBA',(W,H),(0,0,0,0))
  pen=ImageDraw.Draw(glow,'RGBA')
  for _ in range(350):
    x=int(rng.integers(0,W));y=int(rng.integers(0,H))
    if .24<x/W<.76 and .17<y/H<.83 and rng.random()<.68:continue
    radius=float(rng.choice([.45,.6,.7,.8,1,1.5,2.1],p=[.12,.17,.25,.2,.16,.08,.02]))
    color=tuple(int(v) for v in rng.choice([[142,171,225],[179,157,217],[105,159,221],[177,191,230]]))
    alpha=int(rng.integers(44,125))
    pen.ellipse((x-radius,y-radius,x+radius,y+radius),fill=(*color,alpha))
  base=Image.alpha_composite(base.convert('RGBA'),glow.filter(ImageFilter.GaussianBlur(5)))
  return Image.alpha_composite(base,glow).convert('RGB')
def main():
  p=argparse.ArgumentParser()
  p.add_argument('--output',default='public/art/backgrounds')
  p.add_argument('--variant',type=int,default=2,choices=[1,2])
  args=p.parse_args();output=Path(args.output);output.mkdir(parents=True,exist_ok=True)
  img=draw(args.variant)
  name=f'galaxy-v{args.variant}'
  img.save(output/f'{name}-source.png',optimize=True)
  img.save(output/f'{name}.webp',format='WEBP',quality=76,method=6)
  for f in (output/f'{name}-source.png',output/f'{name}.webp'):print(f, f.stat().st_size)
if __name__=='__main__':main()
