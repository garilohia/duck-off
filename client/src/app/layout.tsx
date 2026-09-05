import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
const fredoka=localFont({src:'./fonts/Fredoka.ttf',variable:'--font-fredoka',weight:'400 700',display:'swap'});
export const metadata:Metadata={title:'Duck Off — tap. squeak. win.',description:'One river. Everyone’s ducks. Pick your rubber duck and tap your way to glory.'};
export const viewport:Viewport={width:'device-width',initialScale:1,maximumScale:1,userScalable:false,viewportFit:'cover',themeColor:'#2273e6'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body className={fredoka.variable}>{children}</body></html>}
