import {lazy,Suspense,useEffect,useState,type FormEvent} from 'react';
import {Sparkles,ShieldCheck,CheckCircle2, Zap,Play,Send,MessageSquareText,MessagesSquare,ClipboardList,Check,HardHat,ArrowRight,Download,Menu,X,Wrench,Package,Truck,PlugZap,Brush, BadgeCheck} from 'lucide-react';
const DoneeoWorkspace = lazy(() => import('./components/DoneeoWorkspace'));
import AuthPanel from './components/AuthPanel';
import LandingPlan from './components/LandingPlan';
import { currentCustomer, signOut, type Customer } from './lib/api';
const images='/images/';
const services=[
 {name:'Plumbing',desc:'Leaks, repairs & more',img:'plumbing.webp',icon:Wrench,prompt:'My kitchen sink is leaking and I need it repaired this weekend.'},
 {name:'Electrical',desc:'Wiring & installations',img:'electrical.webp',icon:PlugZap,prompt:'An electrical outlet stopped working. I need safe professional help.'},
 {name:'Cleaning',desc:'Home & office',img:'cleaning.webp',icon:Brush,prompt:'I need a deep cleaning of my apartment before guests arrive.'},
 {name:'Assembly',desc:'Furniture & installation',img:'assembly.webp',icon:Wrench,prompt:'I need help assembling furniture and mounting some shelves.'},
 {name:'Moving',desc:'Hauling & heavy lifting',img:'moving.webp',icon:Truck,prompt:'I need two people to move a sofa and a table to a new apartment.'},
 {name:'Delivery',desc:'Pickup & errands',img:'delivery.webp',icon:Package,prompt:'I need someone to pick up and deliver a large package.'}
];
const steps=[
 {title:'Share your need',desc:'Describe the result you want in your own words.',icon:MessageSquareText},
 {title:'We clarify details',desc:'Doneeo asks follow-up questions whenever key information is missing.',icon:MessagesSquare},
 {title:'We architect the solution',desc:'We match the skills, people and equipment to the complexity of your request.',icon:ClipboardList},
 {title:'You review & approve',desc:'See the scope, schedule and itemized price before you validate and order.',icon:Check},
 {title:'We coordinate every step',desc:'Follow preparation, equipment and execution in one transparent progress tracker.',icon:HardHat},
 {title:'Completion & follow-up',desc:'Review the completed work against the plan, with one bill and satisfaction support.',icon:ShieldCheck}
];
function StoreBadge({platform}:{platform:'apple'|'google'}){const isApple=platform==='apple';return <div className="store-unavailable" title="App download link will be enabled when Doneeo launches" aria-label={`${isApple?'App Store':'Google Play'} — coming soon`}><span className="store-glyph">{isApple?'●':'▶'}</span><span><small>{isApple?'Download on the':'GET IT ON'}</small><strong>{isApple?'App Store':'Google Play'}</strong></span></div>}
export default function App(){const [menu,setMenu]=useState(false),[prompt,setPrompt]=useState(''),[request,setRequest]=useState(''),[info,setInfo]=useState('');
 const [customer, setCustomer] = useState<Customer | null>(null);
 const [authOpen, setAuthOpen] = useState(false);
 const [sessionChecked, setSessionChecked] = useState(false);

 useEffect(() => {
   void currentCustomer().then(user => {
     if (user) setPrompt(sessionStorage.getItem('doneeo.pending-request') || '');
     setCustomer(user);
   }).catch(() => {
     setInfo('Doneeo could not connect. Please check that the Java API is running.');
   }).finally(() => setSessionChecked(true));
 }, []);

 useEffect(() => {
   const expired = () => {
     setCustomer(null);
     setAuthOpen(true);
     setInfo('Please log in again to reopen your saved workspace.');
   };
   window.addEventListener('doneeo:session-expired', expired);
   return () => window.removeEventListener('doneeo:session-expired', expired);
 }, []);

 function start(initial = '') {
   if (!sessionChecked) { setInfo('Checking your account. Please try again in a moment.'); return; }
   const pending = initial || sessionStorage.getItem('doneeo.pending-request') || '';
   setPrompt(pending);
   if (pending) sessionStorage.setItem('doneeo.pending-request', pending);
   setMenu(false);
   if (!customer) setAuthOpen(true);
 }

 function signedIn(user: Customer) {
   setCustomer(user);
   setAuthOpen(false);
   setPrompt(sessionStorage.getItem('doneeo.pending-request') || prompt);

 }

 async function logout() {
   try {
     await signOut();
     if (customer) sessionStorage.removeItem('doneeo.pending-operation.' + customer.id);
     sessionStorage.removeItem('doneeo.pending-request');
     setCustomer(null);

     setPrompt('');
     setInfo('You are logged out. Your saved plans will be here when you log in.');
   } catch (error) {
     setInfo(error instanceof Error ? error.message : 'Please try again.');
   }
 }
 function submit(e:FormEvent){e.preventDefault();if(request.trim().length>=10)start(request.trim());else setInfo('Describe what you need in at least 10 characters to begin.')}
 if (customer) return <Suspense fallback={<p className="workspace-loading" role="status">Opening your Doneeo workspace…</p>}><DoneeoWorkspace key={customer.id} accountId={customer.id} initialRequest={prompt} onStarted={() => sessionStorage.removeItem('doneeo.pending-request')} onSignOut={() => void logout()} /></Suspense>;
 return <><a className="skip" href="#main">Skip to content</a><header className="navbar" id="top"><div className="container nav-inner"><a className="brand" href="#top"><img src={images+'doneeo-logo.png'} alt="Doneeo"/></a><nav className="nav-links"><a href="#how">How it works</a><a href="#services">What we do</a><a href="#plans">Plans</a><a href="#executors">For executors</a><a href="#trust">Support</a></nav><div className="nav-actions"><span className="language">◎ EN⌄</span><button className="nav-login" onClick={()=>customer?void logout():start()}>{customer?"Log out":"Log in"}</button><button className="primary nav-get" onClick={()=>start()}>Get started</button><button className="hamburger" onClick={()=>setMenu(v=>!v)} aria-label={menu?'Close menu':'Open menu'}>{menu?<X/>:<Menu/>}</button></div></div>{menu&&<nav className="mobile-menu"><a onClick={()=>setMenu(false)} href="#how">How it works</a><a onClick={()=>setMenu(false)} href="#services">What we do</a><a onClick={()=>setMenu(false)} href="#plans">Plans</a><a onClick={()=>setMenu(false)} href="#executors">For executors</a><a onClick={()=>setMenu(false)} href="#trust">Support</a><button className="mobile-account" onClick={()=>customer?void logout():start()}>{customer?"Log out":"Log in"}</button></nav>}</header>
 <main id="main"><section className="hero-section"><div className="container hero-layout"><div className="hero-text"><span className="eyebrow"><Sparkles size={18}/> Your AI Service Partner</span><h1>Tell Doneeo what you need,<br/> <em>and we'll take care of the rest.</em></h1><p>Whatever you need done, Doneeo understands the problem, <strong>architects the solution</strong>, and coordinates the right people and equipment. Review a clear plan and detailed price before you approve. We take care of the coordination, from preparation to completion.</p><div className="benefits"><div><Zap/><span>Hassle-free<br/>for you</span></div><div><ShieldCheck/><span>Secure<br/>payments</span></div><div><BadgeCheck/><span>Satisfaction<br/>support</span></div></div><div className="hero-buttons"><button className="primary big" onClick={()=>start()}>Get started free <ArrowRight size={18}/></button><a className="outlined big" href="#how"><Play size={17}/> See how it works</a></div><div className="app-row"><span className="download-label"><Download size={17}/> Download the app</span><StoreBadge platform="apple"/><StoreBadge platform="google"/><span className="coming-soon">Coming soon</span></div></div><div className="hero-visual"><img src={images+'hero-doneeo.webp'} alt="Doneeo AI job planning on a phone next to a customer"/></div></div><div className="container"><form className="ask-bar" onSubmit={submit}><Sparkles className="ask-spark"/><input value={request} onChange={e=>setRequest(e.target.value)} aria-label="Describe your task to Doneeo" placeholder="What do you need help with today? e.g. Fix a kitchen leak this weekend"/><button aria-label="Ask Doneeo"><Send size={20}/></button></form><p className="ask-hint">Just describe your goal. You don't need to know the contractor, equipment, or solution.</p></div></section>
 <section id="how" className="container process-section"><div className="heading center"><h2>How Doneeo <em>gets it done</em> for you</h2><p>From a simple request to a completed job — Doneeo architects and coordinates the work.</p></div><div className="process-grid">{steps.map((s,i)=><div className={'process-card '+(i===2?'active':'')} key={s.title}><div className="step-top"><span className="step-number">{i+1}</span><span className="step-icon"><s.icon size={28} strokeWidth={1.9}/></span></div><h3>{s.title}</h3><p>{s.desc}</p></div>)}</div></section>
 <section id="services" className="container service-section"><div className="heading"><h2>What can we <em>help you with?</em></h2><p>From everyday tasks to complex projects. These are examples, not categories you must choose.</p></div><div className="service-grid">{services.map(s=><button key={s.name} className="service" onClick={()=>start(s.prompt)}><img src={images+s.img} alt=""/><span className="service-copy"><s.icon size={19}/><strong>{s.name}</strong><small>{s.desc}</small></span></button>)}<button className="service more" onClick={()=>start()}><span>•••</span><strong>And more</strong><small>Just ask Doneeo</small></button></div></section>
 <LandingPlan onStart={start}/>
 <section id="executors" className="container executor-cta"><div><strong>Want to execute jobs with Doneeo?</strong><p>Become part of a future network of skilled pros and local helpers.</p></div><button onClick={()=>setInfo('Executor applications will open when onboarding is available.')}>For executors <ArrowRight size={16}/></button></section>
 <section id="trust" className="container trust-section"><div className="trust-statement"><ShieldCheck size={39}/><div><h2>One clear plan.<br/>One accountable partner.</h2><p>Know what is included, approve the cost, and follow the work through to completion.</p></div></div><div className="trust-points"><span><ShieldCheck/> Itemized pricing</span><span><CheckCircle2/> One transaction</span><span><BadgeCheck/> Visible progress</span></div><div className="trust-actions"><button onClick={()=>start()} className="primary">Get started <ArrowRight size={18}/></button></div></section>
 </main><footer className="footer container"><a href="#top"><img src={images+'doneeo-logo.png'} alt="Doneeo"/></a><span>© {new Date().getFullYear()} Doneeo · Test preview. Coordination, bookings and payments are demonstrations.</span></footer>
 {info&&<div className="toast" role="status">{info}<button onClick={()=>setInfo('')} aria-label="Dismiss">×</button></div>}
 {authOpen && <AuthPanel request={prompt} onClose={() => setAuthOpen(false)} onSuccess={signedIn} />}
</>
}
