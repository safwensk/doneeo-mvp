import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PlannerAnalysis, PlannerQuestion } from "../../lib/planner";
import { Button } from "./ui/Button";
import { Check, Send } from "lucide-react";

export type DiscussionMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type Props = {
  request: string;
  setRequest: (request: string) => void;
  analysis: PlannerAnalysis | null;
  messages: DiscussionMessage[];
  question?: PlannerQuestion;
  busy: boolean;
  restoring: boolean;
  ready: boolean;
  blocked: boolean;
  error: string;
  onRequest: () => Promise<boolean>;
  onAnswer: (question: PlannerQuestion, value: string | boolean) => Promise<boolean>;
  onReviewPlan: () => void;
  onNewRequest: () => void;
  onRecheck: () => Promise<void>;
};

export function ConversationScreen({
  request, setRequest, analysis, messages, question, busy, restoring, ready,
  blocked, error, onRequest, onAnswer, onReviewPlan, onNewRequest, onRecheck,
}: Props) {
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState("");
  const [inputError, setInputError] = useState("");
  const inFlight = useRef(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const hasPlan = analysis !== null;
  const taskBlock = analysis?.taskBlocks?.find(block => block.id === question?.taskBlockId);
  const canType = !busy && !restoring && (!hasPlan || Boolean(question));
  const draft = hasPlan ? answer : request;

  useEffect(() => {
    if (hasPlan || pending) bottom.current?.scrollIntoView({ block: "nearest" });
  }, [hasPlan, messages.length, question?.id, pending, ready]);

  useEffect(() => {
    setAnswer("");
    setInputError("");
  }, [question?.id]);

  useEffect(() => {
    if (canType && (!hasPlan || question?.type === "text")) {
      composer.current?.focus({ preventScroll: true });
    }
  }, [canType, hasPlan, question?.id, question?.type]);

  async function send(value?: string | boolean) {
    if (busy || restoring || inFlight.current) return;
    setInputError("");
    let reply: string | boolean = value ?? draft.trim();
    if (!hasPlan && String(reply).length < 10) {
      setInputError("Tell Doneeo a little more about what you need — at least 10 characters.");
      return;
    }
    if (hasPlan) {
      if (!question) return;
      if (question.type === "boolean" && typeof reply !== "boolean") {
        if (/^(yes|y)$/i.test(reply)) reply = true;
        else if (/^(no|n)$/i.test(reply)) reply = false;
        else {
          setInputError("Choose Yes or No for this question.");
          return;
        }
      }
      if (typeof reply === "string" && (reply.length < 2 || reply.length > 300)) {
        setInputError("Add an answer between 2 and 300 characters.");
        return;
      }
    }
    inFlight.current = true;
    setPending(typeof reply === "boolean" ? (reply ? "Yes" : "No") : reply);
    try {
      const accepted = hasPlan && question
        ? await onAnswer(question, reply)
        : await onRequest();
      if (accepted) setAnswer("");
    } finally {
      setPending("");
      inFlight.current = false;
      composer.current?.focus();
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send();
  }

  const assistantClass = "max-w-[92%] rounded-2xl-r border border-line-r bg-canvas-r px-5 py-4 text-sm leading-relaxed text-ink-r";
  const userClass = "ml-auto max-w-[86%] rounded-2xl-r bg-brand-500-r px-5 py-4 text-sm leading-relaxed text-white";

  return <section className="mx-auto max-w-[850px] px-5 pb-8 pt-6 md:px-8">
    <div className="mb-6 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 style={{ fontSize: "clamp(24px, 4vw, 32px)", lineHeight: 1.2 }}>{hasPlan ? "Your conversation" : "What can we get done?"}</h1>
        {!hasPlan && <p className="mt-2 text-sm text-muted-r">Describe your need. We’ll work out the next steps.</p>}
      </div>
      {hasPlan && <button type="button" disabled={busy} onClick={onNewRequest}
        className="shrink-0 rounded-full border border-line-r px-3 py-2 text-xs font-semibold text-muted-r disabled:opacity-40">New request</button>}
    </div>

    <div role="log" aria-label="Conversation with Doneeo" aria-live="polite" aria-relevant="additions text" className="space-y-4">
      <div className={assistantClass}>
        <strong className="mb-2 block text-xs text-brand-600-r">Doneeo</strong>
        Hi, I’m Doneeo. What do you need help with?
      </div>
      {restoring && <p role="status" className="px-2 text-sm text-muted-r">Opening your saved conversation…</p>}
      {messages.map(message => <div key={message.id} className={message.role === "user" ? userClass : assistantClass}>
        <strong className="sr-only">{message.role === "user" ? "You" : "Doneeo"}</strong>
        <p className="whitespace-pre-wrap">{message.text}</p>
      </div>)}
      {!hasPlan && busy && !restoring && !pending && request && <div className={userClass}><strong className="sr-only">You</strong><p className="whitespace-pre-wrap">{request}</p></div>}
      {hasPlan && question && <div className={assistantClass}>
        <strong className="mb-2 block text-xs text-brand-600-r">Doneeo</strong>
        {taskBlock && <p className="mb-2 text-xs font-semibold text-muted-r">Task {taskBlock.sequence} · {taskBlock.title}</p>}
        <p className="font-semibold">{question.label}</p>
        {question.help && <p className="mt-2 text-xs text-muted-r">{question.help}</p>}
        {question.type !== "text" && <div className="mt-4 flex flex-wrap gap-2">
          {(question.type === "boolean" ? ["Yes", "No"] : question.options || []).map(option =>
            <button key={option} type="button" disabled={busy} onClick={() => void send(question.type === "boolean" ? option === "Yes" : option)}
              className="rounded-full border border-brand-200-r bg-surface-r px-4 py-2 text-sm font-semibold text-brand-600-r hover:bg-brand-50-r disabled:opacity-40">{option}</button>)}
        </div>}
      </div>}
      {pending && <div className={userClass}><strong className="sr-only">You</strong><p className="whitespace-pre-wrap">{pending}</p></div>}
      {busy && <p role="status" className="px-2 text-sm text-muted-r">Doneeo is thinking…</p>}
      {hasPlan && !question && !busy && <div className={assistantClass}>
        <strong className="mb-2 block text-xs text-brand-600-r">Doneeo</strong>
        <p>{blocked
          ? analysis.rulesGate?.summary || analysis.safetyNote || "This request needs review before I can offer an execution plan."
          : ready ? "Your plan is ready to review."
          : "I’m checking the last details before preparing your plan."}</p>
      </div>}
    </div>

    {(error || inputError) && <p role="alert" className="mt-4 rounded-xl-r border border-[#edb7ae] bg-[#fff5f2] p-4 text-sm text-[#9c382b]">{inputError || error}</p>}

    {canType && <form onSubmit={submit} className="mt-6 rounded-2xl-r border border-brand-200-r bg-surface-r p-4 shadow-card-r">
      <label htmlFor="doneeo-message" className="sr-only">{hasPlan ? "Your reply" : "Your message to Doneeo"}</label>
      <textarea id="doneeo-message" ref={composer} value={draft} rows={2}
        maxLength={hasPlan ? 300 : 2000}
        onChange={event => hasPlan ? setAnswer(event.target.value) : setRequest(event.target.value)}
        placeholder={hasPlan ? question?.type === "boolean" ? "Reply Yes or No, or choose a button above…" : "Write your answer…" : "Tell me what you need help with…"}
        onKeyDown={event => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void send();
          }
        }}
        className="block w-full resize-none border-0 bg-transparent text-base leading-relaxed text-ink-r outline-none" />
      <div className="mt-3 flex items-center justify-between gap-4">
        <small className="text-xs text-muted-r">Enter to send</small>
        <Button type="submit" disabled={!draft.trim()}>Send <Send size={15} aria-hidden="true" /></Button>
      </div>
    </form>}
    {ready && !question && !blocked && !busy && <Button className="mt-6" size="lg" onClick={onReviewPlan}>Review plan</Button>}
    {hasPlan && !busy && <details className="mt-4 rounded-xl-r border border-line-r p-4 text-sm text-muted-r">
      <summary className="cursor-pointer font-semibold text-ink-r">Request summary</summary>
      <p className="mt-3 leading-relaxed">{analysis.summary}</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5">{analysis.tasks.map((task, index) => <li key={`${index}-${task}`}>{task}</li>)}</ol>
    </details>}
    {hasPlan && !question && !ready && !blocked && !busy && <Button className="mt-6" variant="secondary" onClick={() => void onRecheck()}>Check plan readiness</Button>}
    {hasPlan && !busy && <p className="mt-4 flex items-center justify-center gap-1 text-xs text-muted-r"><Check size={13} aria-hidden="true" />Saved to your account</p>}
    <div ref={bottom} />
  </section>;
}
