import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CheckCircle2, Clock3 } from 'lucide-react';
import AuthPanel from './AuthPanel';
import ExecutorOnboarding from './ExecutorOnboarding';
import ExecutorWorkspace from './ExecutorWorkspace';
import { api, ApiError, currentCustomer, signOut, type Customer } from '../lib/api';
import { documentLabels, profileUrl, roles, workspaceUrl, type Profile, type Workspace } from '../lib/executor';
import '../executor-landing.css';
import '../executor-profile.css';
import '../executor-workspace.css';

type Session = { state:'checking'|'signed-out'|'unavailable' } | { state:'signed-in'; account:Customer };

export default function ExecutorProfilePage() {
  const [session,setSession] = useState<Session>({state:'checking'});
  const [retry,setRetry] = useState(0);
  const [signingOut,setSigningOut] = useState(false);
  const [error,setError] = useState('');
  const expireSession = useCallback(()=>setSession({state:'signed-out'}),[]);
  useEffect(()=>{document.title='Doneeo worker workspace';},[]);
  useEffect(()=>{
    let active=true;
    void currentCustomer().then(account=>{if(active)setSession(account?{state:'signed-in',account}:{state:'signed-out'});})
      .catch(()=>{if(active)setSession({state:'unavailable'});});
    return()=>{active=false;};
  },[retry]);

  async function logout() {
    setSigningOut(true);
    setError('');
    try { await signOut(); setSession({state:'signed-out'}); }
    catch { setError('Doneeo couldn’t sign you out. Please try again.'); }
    finally { setSigningOut(false); }
  }

  if(session.state==='signed-in') return <AuthenticatedWorker key={session.account.id} account={session.account} onSignOut={()=>void logout()}
    signingOut={signingOut} sessionError={error} onExpired={expireSession}/>;

  return <div className="executor-page executor-profile-page">
    <SetupHeader />
    <main className="executor-profile-main" id="worker-main">
      {session.state==='checking' && <p role="status">Checking your Doneeo account…</p>}
      {session.state==='unavailable' && <><h1>Open your Doneeo profile</h1><p role="alert">Doneeo couldn’t check your account.</p><button className="primary" type="button" onClick={()=>{setSession({state:'checking'});setRetry(value=>value+1);}}>Try again</button></>}
      {session.state==='signed-out' && <AuthPanel request="" purpose="executor" onSuccess={account=>setSession({state:'signed-in',account})} />}
    </main>
    <footer className="executor-profile-footer">Work with Doneeo</footer>
  </div>;
}

function SetupHeader({onSignOut,signingOut}: {onSignOut?:()=>void;signingOut?:boolean}) {
  return <header className="executor-profile-header"><div className="executor-container">
    <a className="executor-brand" href="/executors"><img src="/images/doneeo-logo.png" alt="Doneeo" width="178" height="51" /></a>
    <a className="executor-profile-back" href="/executors"><ArrowLeft size={18} aria-hidden="true" /> Work with Doneeo</a>
    {onSignOut && <button className="executor-profile-link" type="button" disabled={signingOut} onClick={onSignOut}>{signingOut?'Signing out…':'Sign out'}</button>}
  </div></header>;
}

function AuthenticatedWorker({account,onSignOut,signingOut,sessionError,onExpired}: {
  account:Customer; onSignOut:()=>void; signingOut:boolean; sessionError:string; onExpired:()=>void;
}) {
  const [workspace,setWorkspace] = useState<Workspace>();
  const [draft,setDraft] = useState<Profile|null>(null);
  const [stage,setStage] = useState<'setup'|'submitted'|'workspace'>('setup');
  const [editing,setEditing] = useState(false);
  const [error,setError] = useState('');
  const [retry,setRetry] = useState(0);
  useEffect(()=>{
    let active=true;
    void Promise.all([api<Workspace>(workspaceUrl),api<Profile|null>(`${profileUrl}/draft`)]).then(([value,saved])=>{
      if(!active)return;
      setWorkspace(value);
      setDraft(saved);
      setStage(value.profile?.setup ? 'workspace' : 'setup');
    }).catch(issue=>{
      if(!active)return;
      if(issue instanceof ApiError && issue.status===401) onExpired();
      else setError('Doneeo couldn’t load your work profile.');
    });
    return()=>{active=false;};
  },[onExpired,retry]);

  if(workspace && stage==='workspace') return <ExecutorWorkspace account={account} workspace={workspace} onUpdate={setWorkspace} onSignOut={onSignOut}
    signingOut={signingOut} error={sessionError} onEdit={()=>{setEditing(true);setStage('setup');}} />;

  return <div className="executor-page worker-setup">
    <a href="#worker-main" className="skip">Skip to content</a>
    <SetupHeader onSignOut={onSignOut} signingOut={signingOut} />
    <main className="worker-setup-main" id="worker-main">
      {(error||sessionError) && <p className="worker-error" role="alert">{error||sessionError}</p>}
      {!workspace && (error ? <button className="primary" type="button" onClick={()=>{setError('');setRetry(i=>i+1);}}>Try again</button> : <p role="status">Loading your work profile…</p>)}
      {workspace && stage==='setup' && <ExecutorOnboarding accountId={account.id} initial={draft??workspace.profile}
        workspace={workspace} editing={editing} onDocuments={documents=>setWorkspace(current=>current?{...current,documents}:current)}
        onFinish={profile=>{
          setDraft(null);
          setWorkspace(current=>current?{...current,profile}:current);
          setStage(editing?'workspace':'submitted');
          void api<Workspace>(workspaceUrl).then(setWorkspace).catch(()=>{});
        }}
        onPause={()=>{
          if(editing){setEditing(false);setStage('workspace');void api<Profile|null>(`${profileUrl}/draft`).then(setDraft).catch(()=>{});}
          else window.location.assign('/executors');
        }} />}
      {workspace && stage==='submitted' && <Submitted workspace={workspace} open={()=>setStage('workspace')} edit={()=>{setEditing(true);setStage('setup');}} />}
    </main>
  </div>;
}

function Submitted({workspace,open,edit}: {workspace:Workspace;open:()=>void;edit:()=>void}) {
  const profile=workspace.profile;
  const role=roles.find(option=>option.value===profile?.role);
  const required=workspace.documents.filter(doc=>doc.kind==='identity'||(doc.kind==='trade'&&profile?.role==='professional')||(doc.kind==='driver'&&profile?.setup?.driverLicensed));
  return <section className="worker-fields">
    <h1>Profile submitted</h1>
    <p>You can open your workspace while Doneeo reviews your documents.</p>
    <div className="worker-grid worker-panel">
      <section className="worker-fields"><h2>Verification status</h2>
        {required.map(doc=><div className="worker-kit-item" key={doc.kind}>{doc.status==='VERIFIED' ? <CheckCircle2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}<strong>{documentLabels[doc.kind]}</strong><span className="worker-pill">{doc.status==='VERIFIED'?'Verified':doc.status==='NEEDS_UPDATE'?'Needs update':'In review'}</span></div>)}
        <p>You’ll see updates in Notifications.</p>
      </section>
      <section className="worker-fields"><h2>Your work profile</h2>
        <dl className="worker-definition"><div><dt>Role</dt><dd>{role?.brand}</dd></div><div><dt>Service area</dt><dd>{profile?.serviceArea} · {profile?.setup?.radiusKm} km</dd></div><div><dt>Availability</dt><dd>{profile?.availability.length ?? 0} days each week</dd></div></dl>
        <button className="worker-link" type="button" onClick={edit}>Edit profile</button>
      </section>
    </div>
    <p className="worker-note"><BriefcaseBusiness size={20} aria-hidden="true" /> Job offers become available after the required checks are approved and your calendar shows you’re free.</p>
    <div className="worker-actions"><button type="button" className="primary" onClick={open}>Open Jobs workspace <ArrowRight size={18} aria-hidden="true" /></button></div>
  </section>;
}
