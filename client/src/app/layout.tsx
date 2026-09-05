import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
const fredoka=localFont({src:'./fonts/Fredoka.ttf',variable:'--font-fredoka',weight:'400 700',display:'swap'});
export const metadata:Metadata={title:'Duck Off — tap. squeak. win.',description:'Tiny ducks, big heart. Make a room, invite your friends, and tap your way through an adorable little race.'};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#fce4d9'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body className={fredoka.variable}>{children}</body></html>}
