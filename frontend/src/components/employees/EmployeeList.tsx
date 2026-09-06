import React from 'react';
import { MagnifyingGlassIcon, UsersIcon } from '@heroicons/react/24/outline';
import { Badge, Card, EmptyState, Skeleton, Table, Td, Th, Tr } from '../ui';
import EmployeeAvatar from './EmployeeAvatar';
import { ConsentBadge, accessRoleOf } from './Bits';
import {
  accountForEmployee,
  fullName,
  type Employee,
  type UserAccount,
} from './model';

// The list is the page's primary surface: search, one row per person, and the
// whole row is the click target. Actions live in the detail panel and the full
// record, so there is no icon column (DESIGN.md "Table row").

// Fixed layout so a long email cannot push the Review column off the card;
// the cells truncate instead (min-width 680 then scrolls).
const COLUMNS: Array<[string, string]> = [
  ['Person', 'w-[36%]'],
  ['Department', 'w-[22%]'],
  ['Access role', 'w-[15%]'],
  ['Account', 'w-[11%]'],
  ['Review', 'w-[16%]'],
];

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index} className="border-t border-line">
          <Td>
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-7 w-7 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          </Td>
          <Td>
            <Skeleton className="h-3.5 w-24" />
          </Td>
          <Td>
            <Skeleton className="h-[22px] w-20" />
          </Td>
          <Td>
            <Skeleton className="h-3.5 w-14" />
          </Td>
          <Td>
            <Skeleton className="h-[22px] w-24" />
          </Td>
        </tr>
      ))}
    </>
  );
}

export default function EmployeeList({
  employees,
  total,
  users,
  loading,
  query,
  onQueryChange,
  selectedId,
  onSelect,
  addPersonAction,
}: {
  employees: Employee[];
  total: number;
  users: UserAccount[];
  loading: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  addPersonAction?: React.ReactNode;
}) {
  const empty = !loading && employees.length === 0;

  return (
    <Card flush className="min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <label htmlFor="people-search" className="sr-only">
          Search people
        </label>
        <input
          id="people-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search name, email, department, role"
          // The base-layer input reset in tailwind.css outranks a plain utility
          // (three :not() attribute selectors), so the ground and hairline the
          // toolbar search needs have to be marked important.
          className="h-8 min-w-[200px] flex-1 rounded-md border border-line bg-bg px-2.5 text-[13px] text-ink transition-[border-color,box-shadow] duration-hover placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-tint"
        />
        <span className="font-mono text-xs text-ink-3">
          {employees.length} of {total}
        </span>
      </div>

      {empty ? (
        <div className="p-4">
          {total === 0 ? (
            <EmptyState
              icon={<UsersIcon />}
              title="No people yet"
              body="Add the first employee record, or import your team from a CSV."
              action={addPersonAction}
            />
          ) : (
            <EmptyState
              icon={<MagnifyingGlassIcon />}
              title="No matches"
              body="Nobody matches this search. Try another name, email, department or role."
            />
          )}
        </div>
      ) : (
        <Table className="min-w-[680px] table-fixed">
          <thead>
            <tr>
              {COLUMNS.map(([column, width]) => (
                <Th key={column} className={width}>
                  {column}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows />
            ) : (
              employees.map((employee) => {
                const account = accountForEmployee(employee, users);
                return (
                  <Tr
                    key={employee.id}
                    clickable
                    selected={selectedId === employee.id}
                    tabIndex={0}
                    onClick={() => onSelect(employee.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelect(employee.id);
                      }
                    }}
                    className="focus:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-tint"
                  >
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <EmployeeAvatar employee={employee} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">
                            {fullName(employee)}
                          </span>
                          <span className="block truncate font-mono text-xs text-ink-3">
                            {employee.email}
                          </span>
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <span className="block truncate text-ink">
                        {employee.department || 'Unassigned'}
                      </span>
                      <span className="block truncate text-xs text-ink-3">
                        {employee.jobTitle || 'No job title'}
                      </span>
                    </Td>
                    <Td>
                      <Badge>{accessRoleOf(account)}</Badge>
                    </Td>
                    <Td>
                      {account ? (
                        <span className="text-[13px] text-ink-2">Linked</span>
                      ) : (
                        <span className="text-[13px] text-ink-3">Missing</span>
                      )}
                    </Td>
                    <Td>
                      <ConsentBadge employee={employee} />
                    </Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
