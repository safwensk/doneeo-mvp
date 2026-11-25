import { useState, useEffect, useRef, type FormEvent } from 'react';
import { X, Send, Layers, Sparkles, RotateCcw, CheckCircle2 } from 'lucide-react';
import { latestChat, sendChat, type ChatCommand, type ChatReply } from '../lib/chat';
import { ApiError } from '../lib/api';

const examples = [
  'Several things need to happen before our community event.',
  'I need help moving a sofa and assembling a desk.',
  'I need a plan for getting an unused room ready for work.',
];

export default function ChatPanel({ open, onClose, initial, accountId, onLoginRequired, onStarted }: {
  open: boolean;
  onClose: () => void;
  initial: string;
  accountId: string;
  onLoginRequired: () => void;
  onStarted: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<ChatReply | null>(null);
  const [error, setError] = useState('');
  const initialized = useRef(false);
  const inFlight = useRef(false);
  const pending = useRef<ChatCommand | null>(null);
  const conversationId = useRef<string>(crypto.randomUUID());
  const end = useRef<HTMLDivElement>(null);
  const pendingKey = 'doneeo.pending-operation.' + accountId;

  useEffect(() => {
    if (!open) { initialized.current = false; return; }
    document.body.classList.add('no-scroll');
    return () => document.body.classList.remove('no-scroll');
  }, [open]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [reply, busy, error]);
  useEffect(() => {
    if (!open || initialized.current) return;
    initialized.current = true;
    const saved = sessionStorage.getItem(pendingKey);
    if (saved) {
      try {
        pending.current = JSON.parse(saved) as ChatCommand;
        conversationId.current = pending.current.conversationId;
        void run(pending.current);
        return;
      } catch { sessionStorage.removeItem(pendingKey); }
    }
    if (initial.trim().length >= 10) {
      void submit(initial);
    } else {
      setBusy(true);
      void latestChat().then(savedReply => {
        setReply(savedReply);
        if (savedReply) conversationId.current = savedReply.conversationId;
      }).catch(caught => handleError(caught)).finally(() => setBusy(false));
    }
  }, [open, initial, pendingKey]);

  function handleError(caught: unknown) {
    if (caught instanceof ApiError && caught.status === 401) {
      onLoginRequired();
      return;
    }
    setError(caught instanceof Error ? caught.message : 'Please retry your request.');
  }

  async function run(command: ChatCommand) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    pending.current = command;
    sessionStorage.setItem(pendingKey, JSON.stringify(command));
    try {
      const result = await sendChat(command);
      setReply(result);
      setDraft('');
      pending.current = null;
      sessionStorage.removeItem(pendingKey);
      onStarted();
    } catch (caught) {
      handleError(caught);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function submit(value: string | boolean) {
    if (inFlight.current) return;
    const message = typeof value === 'boolean' ? value ? 'Yes' : 'No' : value.trim();
    if (message.length < (reply ? 2 : 10)) {
      setError(reply ? 'Please add a little more detail.' : 'Describe your request in at least 10 characters.');
      return;
    }
    const command: ChatCommand = {
      conversationId: conversationId.current,
      operationId: crypto.randomUUID(),
      message,
    };
    if (reply?.nextQuestion) {
      command.questionId = reply.nextQuestion.id;
      command.answer = value;
    }
    await run(command);
  }

  function newRequest() {
    if (busy) return;
    conversationId.current = crypto.randomUUID();
    pending.current = null;
    sessionStorage.removeItem(pendingKey);
    setReply(null);
    setDraft('');
    setError('');
  }

  function formSubmit(event: FormEvent) { event.preventDefault(); void submit(draft); }
  if (!open) return null;
  const question = reply?.nextQuestion;
  const choices = question?.type === 'boolean' ? ['Yes', 'No'] : question?.options;
  const savedRequest = pending.current?.message;
  const isText = !reply || question?.type === 'text';
  return <div className="chat-overlay" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <section className="chat-panel" role="dialog" aria-modal="true" aria-label="Doneeo job architect">
      <div className="chat-head">
        <div className="chat-head-icon"><Sparkles size={21} /></div>
        <div><strong>Doneeo</strong><span>Your request, one connected plan</span></div>
        <button className="icon-button" onClick={onClose} aria-label="Close chat"><X size={22} /></button>
      </div>
      <div className="chat-body">
        <div className="chat-welcome"><Sparkles size={28} />
          <h3>{reply ? 'Your plan is taking shape.' : 'What do you need help with?'}</h3>
          <p>{reply ? 'Your conversation is saved to your account.' : 'Describe your situation. Doneeo will work out the steps and resources with you.'}</p>
        </div>
        {!reply && !busy && !error && <div className="example-prompts">
          {examples.map(example => <button key={example} onClick={() => void submit(example)}>{example}</button>)}
        </div>}
        {reply?.history.map((entry, index) => <div key={index} className={'message ' + entry.side}>
          <div className="message-content">
            {entry.side === 'agent' && <span className="agent-label"><Sparkles size={13} /> Doneeo</span>}
            <p>{entry.text}</p>
          </div>
        </div>)}
        {busy && savedRequest && <div className="message user"><div className="message-content"><p>{savedRequest}</p></div></div>}
        {reply && <PlanCard reply={reply} />}
        {question?.help && <p className="question-help">{question.help}</p>}
        {choices && !error && <div className="question-choices">
          {choices.map(choice => <button key={choice} disabled={busy} onClick={() => {
            void submit(question?.type === 'boolean' ? choice === 'Yes' : choice);
          }}>{choice}</button>)}
        </div>}
        {busy && <p className="thinking" role="status">Doneeo is analysing your request and checking the plan…</p>}
        {error && <div className="chat-error" role="alert">
          <p>{error}</p>
          {pending.current && <button disabled={busy} onClick={() => void run(pending.current!)}>Retry this request</button>}
        </div>}
        <div ref={end} />
      </div>
      <div className="chat-foot">
        {isText && <form onSubmit={formSubmit} className="chat-compose">
          <input aria-label="Message Doneeo" value={draft}
            maxLength={reply ? 300 : 2000} onChange={event => setDraft(event.target.value)}
            placeholder={reply ? 'Answer Doneeo’s question…' : 'Tell Doneeo what you need…'}
            disabled={busy || !!pending.current} />
          <button type="submit" disabled={busy || !!pending.current || draft.trim().length < (reply ? 2 : 10)}
            aria-label="Send message"><Send size={19} /></button>
        </form>}
        {reply && <button className="new-request-link" onClick={newRequest} disabled={busy}><RotateCcw size={14} /> Start another request</button>}
        <span className="demo-note"><CheckCircle2 size={13} />
          {reply?.mode.startsWith('safe-fallback') ? 'Rules-based draft · Saved to your account' : 'Your request and plan are saved to your account'}
        </span>
      </div>
    </section>
  </div>;
}

function PlanCard({ reply }: { reply: ChatReply }) {
  const { analysis, control } = reply;
  const resources = analysis.intelligence?.resources.map(resource => resource.name)
    ?? analysis.equipment.map(item => item.name);
  return <div className="job-plan">
    <div className="job-plan-title"><Layers size={20} /><div>
      <strong>{analysis.title}</strong>
      <span>{control.requirementReady ? 'Requirements ready for review' : 'Developing your work plan'}</span>
    </div></div>
    <details open={control.requirementReady}>
      <summary>Work, resources and completion</summary>
      <ol>{analysis.executionSteps.map((step, index) => <li key={index}>{step}</li>)}</ol>
      {resources.length > 0 && <p><strong>Resources to arrange</strong><br />{resources.join(', ')}</p>}
      {analysis.skillRequirements.length > 0 && <p><strong>Skills needed</strong><br />{analysis.skillRequirements.join(', ')}</p>}
      {analysis.intelligence?.workstreams.map((stream, index) =>
        <p key={index}><strong>{stream.title}</strong><br />{stream.completionGate}</p>)}
    </details>
    <details><summary>What Doneeo already knows</summary>
      <ul>{analysis.understoodFacts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>
    </details>
    {analysis.rulesGate?.status === 'blocked' && <p className="form-error">{analysis.rulesGate.summary}</p>}
    <p className="plan-disclaimer">Draft planning · Provider availability, final pricing and booking require confirmation.</p>
  </div>;
}
