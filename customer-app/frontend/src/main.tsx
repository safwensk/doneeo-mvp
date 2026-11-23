import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './styles.css';
import './landing-plan.css';
const ExecutorLanding = React.lazy(() => import('./components/ExecutorLanding'));
const isExecutorPage = /^\/executors\/?$/.test(window.location.pathname);
createRoot(document.getElementById('root')!).render(<React.StrictMode>{isExecutorPage
  ? <React.Suspense fallback={<p className="workspace-loading" role="status">Opening Doneeo…</p>}><ExecutorLanding/></React.Suspense>
  : <App/>}</React.StrictMode>);
