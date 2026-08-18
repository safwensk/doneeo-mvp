/** Intelligence-owned stable TaskBlock identities for one WorkCase. */
export type TaskIdentity = {
  taskId: string;
  semanticKey: string;
  ordinal: number;
  title: string;
  domain: string;
  status: "ACTIVE" | "RETIRED";
};

export type TaskIdentityCandidate = {
  title: string;
  domain: string;
  ordinal: number;
};

/**
 * Reconcile by exact normalized outcome+domain identity, not provider state.
 * A task moving to another ordinal retains identity. New/removed outcomes are
 * explicit. Material detail changes inside the same requested outcome are
 * represented later by Requirement Contract fingerprints, not a new task id.
 */
export function reconcileTaskIdentities(
  previous: readonly TaskIdentity[],
  candidates: readonly TaskIdentityCandidate[],
  newTaskId: () => string,
): TaskIdentity[] {
  const activeByKey = new Map(previous.filter(task => task.status === "ACTIVE").map(task => [task.semanticKey, task]));
  const used = new Set<string>();
  const next: TaskIdentity[] = candidates.map(candidate => {
    const semanticKey = taskSemanticKey(candidate.title, candidate.domain);
    const prior = activeByKey.get(semanticKey);
    if (prior && !used.has(prior.taskId)) {
      used.add(prior.taskId);
      return { ...prior, semanticKey, ordinal: candidate.ordinal, title: candidate.title, domain: candidate.domain, status: "ACTIVE" };
    }
    const taskId = newTaskId();
    if (!taskId.trim() || used.has(taskId) || previous.some(task => task.taskId === taskId)) throw new Error(`invalid or duplicate generated task id: ${taskId}`);
    used.add(taskId);
    return { taskId, semanticKey, ordinal: candidate.ordinal, title: candidate.title, domain: candidate.domain, status: "ACTIVE" };
  });

  for (const prior of previous) {
    if (!used.has(prior.taskId)) next.push({ ...prior, status: "RETIRED" });
  }
  return next.sort((a, b) => a.status === b.status ? a.ordinal - b.ordinal : a.status === "ACTIVE" ? -1 : 1);
}

export function taskSemanticKey(title: string, domain: string): string {
  return `${normalize(domain)}::${normalize(title)}`;
}

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
