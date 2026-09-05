// Default onboarding and offboarding checklists for a UK employer. These are
// the statutory and practical steps a small company forgets, in the order it
// usually needs them. There is no template editor — a company that needs one
// has outgrown this product's checklist.

export type ChecklistTemplateItem = {
  title: string;
  /** Days from the employee's start (onboarding) or end (offboarding) date. */
  offsetDays: number;
  /** Set when completing the item should also do the thing. */
  actionKey?: ChecklistAction;
};

export type ChecklistAction = 'REVOKE_LOGIN' | 'SET_RETAIN_UNTIL' | 'END_SPONSORSHIP';

export const CHECKLIST_KINDS = ['ONBOARDING', 'OFFBOARDING'] as const;
export type ChecklistKind = (typeof CHECKLIST_KINDS)[number];

const ONBOARDING: ChecklistTemplateItem[] = [
  { title: 'Right-to-work check completed and filed', offsetDays: 0 },
  { title: 'Signed contract returned', offsetDays: 0 },
  { title: 'Starter checklist (P45 or HMRC starter) received', offsetDays: 3 },
  { title: 'Bank details and payroll record set up', offsetDays: 5 },
  { title: 'Emergency contact recorded', offsetDays: 5 },
  { title: 'Privacy notice issued and consent recorded', offsetDays: 7 },
  { title: 'Pension auto-enrolment assessed', offsetDays: 30 },
  { title: 'Probation review booked', offsetDays: 14 },
];

const OFFBOARDING: ChecklistTemplateItem[] = [
  { title: 'Resignation or termination letter filed', offsetDays: -14 },
  { title: 'Final pay and outstanding holiday calculated', offsetDays: -7 },
  { title: 'P45 issued', offsetDays: 7 },
  { title: 'Equipment, keys and passes returned', offsetDays: 0 },
  {
    title: 'Report the sponsored worker leaving to the Home Office',
    offsetDays: 0,
    actionKey: 'END_SPONSORSHIP',
  },
  { title: 'Revoke system login', offsetDays: 1, actionKey: 'REVOKE_LOGIN' },
  {
    title: 'Set the data retention date on the record',
    offsetDays: 7,
    actionKey: 'SET_RETAIN_UNTIL',
  },
];

export const CHECKLIST_TEMPLATES: Record<ChecklistKind, ChecklistTemplateItem[]> =
  {
    ONBOARDING,
    OFFBOARDING,
  };

/**
 * Turn a template into rows for one employee. `anchor` is the start date for
 * onboarding and the leaving date for offboarding; without one the items are
 * still created, just undated.
 */
export function buildChecklist(
  kind: ChecklistKind,
  anchor: Date | null,
): { kind: ChecklistKind; actionKey: string | null; title: string; dueDate: Date | null; sortOrder: number }[] {
  return CHECKLIST_TEMPLATES[kind].map((item, index) => {
    let dueDate: Date | null = null;
    if (anchor) {
      dueDate = new Date(anchor);
      dueDate.setUTCDate(dueDate.getUTCDate() + item.offsetDays);
    }
    return {
      kind,
      actionKey: item.actionKey ?? null,
      title: item.title,
      dueDate,
      sortOrder: index,
    };
  });
}
