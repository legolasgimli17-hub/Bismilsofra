'use client';
import {useEffect,useState} from 'react';import {CameraOff} from 'lucide-react';import {photoUrl} from '@/lib/discovery';
export default function FoodImage({src,alt,className='',priority=false}:{src:string|null|undefined;alt:string;className?:string;priority?:boolean}){
 const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[src]);const valid=photoUrl(src);
 return <div className={`food-photo ${className}`}>{valid&&!failed?<img src={valid} alt={alt} loading={priority?'eager':'lazy'} decoding="async" fetchPriority={priority?'high':'auto'} onError={()=>setFailed(true)}/>:<div className="image-placeholder" role="img" aria-label={`${alt} — fotoğraf henüz mevcut değil`}><CameraOff size={22}/><span>Fotoğraf henüz mevcut değil</span></div>}</div>;
}
