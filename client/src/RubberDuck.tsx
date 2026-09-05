// A little rubber duckie that looks the same on every OS (the 🦆 emoji is a mallard on Apple devices).
export default function RubberDuck({size=120,className='',bob=false}:{size?:number;className?:string;bob?:boolean}){
 return <svg className={`rubber-duck${bob?' bob':''} ${className}`} width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="A rubber duck" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="60" cy="102" rx="34" ry="6" fill="#173d72" opacity=".12"/>
  <ellipse cx="58" cy="76" rx="40" ry="26" fill="#ffd02b"/>
  <ellipse cx="88" cy="72" rx="16" ry="10" fill="#ffd02b" transform="rotate(-25 88 72)"/>
  <circle cx="42" cy="44" r="24" fill="#ffd02b"/>
  <ellipse cx="34" cy="64" rx="13" ry="8" fill="#ffc70e"/>
  <path d="M22 46 Q8 44 8 50 Q10 58 24 56 Z" fill="#f58220"/>
  <path d="M22 50 Q12 51 10 53 Q13 57 24 55 Z" fill="#e96b0e"/>
  <circle cx="34" cy="40" r="4.2" fill="#152333"/>
  <circle cx="32.6" cy="38.6" r="1.4" fill="#fff"/>
  <ellipse cx="30" cy="52" rx="4" ry="2.2" fill="#f79763" opacity=".8"/>
  <path d="M44 84 Q52 74 66 80 Q58 90 44 84 Z" fill="#ffc70e"/>
 </svg>;
}
