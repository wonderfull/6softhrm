import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Button,
  Input,
  Card,
  Badge,
  KpiTile,
  EmptyState,
  Skeleton,
} from '../components/ui';

describe('ui primitives', () => {
  it('Button renders variants and sizes on the token classes', () => {
    render(
      <>
        <Button>Save</Button>
        <Button variant="secondary" size="sm">Cancel</Button>
        <Button variant="destructive" size="lg">Delete</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Save' }).className).toContain('btn-primary');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel.className).toContain('btn-secondary');
    expect(cancel.className).toContain('h-8');
    const del = screen.getByRole('button', { name: 'Delete' });
    expect(del.className).toContain('btn-destructive');
    expect(del.className).toContain('h-10');
  });

  it('Button shows a busy label and blocks clicks while loading', () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('Input wires label, help and error text with aria attributes', () => {
    const { rerender } = render(<Input label="Email" help="Work address" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAccessibleDescription('Work address');
    expect(input).not.toHaveAttribute('aria-invalid');
    rerender(<Input label="Email" error="Enter a valid email" />);
    const invalid = screen.getByLabelText('Email');
    expect(invalid).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
  });

  it('Card renders an optional header with title, description and action', () => {
    render(
      <Card title="Leave" description="This year" action={<button>View all</button>}>
        body
      </Card>,
    );
    expect(screen.getByRole('heading', { name: 'Leave' })).toBeInTheDocument();
    expect(screen.getByText('This year')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View all' })).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('Badge maps tones to the three status classes and neutral', () => {
    render(
      <>
        <Badge tone="ok">Approved</Badge>
        <Badge tone="warn">Pending</Badge>
        <Badge tone="bad">Expired</Badge>
        <Badge>ADMIN</Badge>
      </>,
    );
    expect(screen.getByText('Approved').className).toContain('badge-ok');
    expect(screen.getByText('Pending').className).toContain('badge-warn');
    expect(screen.getByText('Expired').className).toContain('badge-bad');
    expect(screen.getByText('ADMIN').className).toContain('badge-neutral');
  });

  it('KpiTile shows label, tabular value, footnote and an inline badge', () => {
    render(
      <KpiTile label="Headcount" value={42} footnote="3 starters this month" badge={<Badge tone="warn">2 due</Badge>} />,
    );
    expect(screen.getByText('Headcount')).toBeInTheDocument();
    expect(screen.getByText('42').className).toContain('tabular-nums');
    expect(screen.getByText('3 starters this month')).toBeInTheDocument();
    expect(screen.getByText('2 due')).toBeInTheDocument();
  });

  it('KpiTile renders a skeleton while loading', () => {
    const { container } = render(<KpiTile label="Headcount" value={0} loading />);
    expect(container.querySelector('.skeleton')).not.toBeNull();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('EmptyState renders title, body and one optional action', () => {
    render(
      <EmptyState title="No employees yet" body="Add your first employee to get started." action={<Button variant="secondary" size="sm">Add employee</Button>} />,
    );
    expect(screen.getByText('No employees yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add employee' })).toBeInTheDocument();
  });

  it('Skeleton is presentational and takes a width/height', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain('skeleton');
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });
});
