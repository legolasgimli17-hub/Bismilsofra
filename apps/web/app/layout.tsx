import type {Metadata,Viewport} from 'next';
import Providers from '@/components/providers';import Shell from '@/components/shell';import './globals.css';
export const metadata:Metadata={title:'Bismil Sofra | Bismil’in yemekleri',description:'Bismil için geliştirilen yerel yemek sipariş platformu. Restoran keşfi, menü, sepet ve sipariş takibi.',manifest:'/manifest.webmanifest'};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#14382b'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="tr"><body><Providers><Shell>{children}</Shell></Providers></body></html>}
