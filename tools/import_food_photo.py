#!/usr/bin/env python3
"""Import a restaurant-owned or licensed food photo as a clean, optimized local WebP.
Usage: python tools/import_food_photo.py --input photo.jpg --slug kebap
This is an operator CLI for image preparation, not a production upload endpoint.
"""
from __future__ import annotations
import argparse, re
from pathlib import Path
from PIL import Image, ImageOps, UnidentifiedImageError

BASE=Path(__file__).resolve().parents[1]/'apps'/'web'/'public'/'photos'
MAX_INPUT_BYTES=15*1024*1024

def import_photo(source:Path,slug:str,dest:Path=BASE)->Path:
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]{1,60}',slug):
        raise ValueError('Slug sadece küçük harf, sayı, kısa çizgi ve alt çizgi içermeli.')
    if source.stat().st_size>MAX_INPUT_BYTES:raise ValueError('Fotoğraf 15 MB sınırını aşıyor.')
    with Image.open(source) as original:
        if original.format not in {'JPEG','PNG','WEBP'}:raise ValueError('Sadece JPEG/PNG/WebP desteklenir.')
        if original.width*original.height>40_000_000:raise ValueError('Çok büyük görüntü: 40 milyon piksel sınırı.')
        pic=ImageOps.exif_transpose(original).convert('RGB')
        pic.thumbnail((1600,1200),Image.Resampling.LANCZOS)
        dest.mkdir(parents=True,exist_ok=True)
        output=dest/(slug+'.webp')
        pic.save(output,format='WEBP',quality=82,method=6,exif=b'')
        return output

if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Restorana ait gerçek fotoğrafı web için hazırla')
    parser.add_argument('--input',type=Path,required=True)
    parser.add_argument('--slug',required=True)
    args=parser.parse_args()
    try:print(import_photo(args.input,args.slug))
    except (ValueError,UnidentifiedImageError,FileNotFoundError) as exc:parser.error(str(exc))
