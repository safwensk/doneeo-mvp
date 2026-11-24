import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './styles.css';
import './landing-plan.css';
const ExecutorLanding = React.lazy(() => import('./components/ExecutorLanding'));
const ExecutorProfilePage = React.lazy(() => import('./components/ExecutorProfilePage'));
const path = window.location.pathname.replace(/\/$/, '');
const Page = path === '/executors/profile' ? ExecutorProfilePage : path === '/executors' ? ExecutorLanding : App;
createRoot(document.getElementById('root')!).render(<React.StrictMode>
  <React.Suspense fallback={<p className="workspace-loading" role="status">Opening Doneeo…</p>}><Page /></React.Suspense>
</React.StrictMode>);

