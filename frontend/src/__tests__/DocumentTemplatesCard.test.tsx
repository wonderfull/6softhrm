import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DocumentTemplatesCard from '../components/DocumentTemplatesCard';
import * as api from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPut: vi.fn(),
    apiDelete: vi.fn(),
  };
});

const TEMPLATE = {
  id: 1,
  name: 'Statement of main terms',
  body: '<p>Dear {{firstName}}</p>',
  documentType: 'CONTRACT',
  requiresAcknowledgement: true,
};

const EMPLOYEES = [{ id: 5, firstName: 'Ella', lastName: 'Ng' }];

function mockApi(templates: any[]) {
  (api.apiGet as any).mockImplementation((path: string) =>
    path === '/document-templates'
      ? Promise.resolve(templates)
      : Promise.resolve(path === '/employees' ? EMPLOYEES : []),
  );
}

describe('DocumentTemplatesCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi([]);
  });

  it('creates a template and names the placeholders it can fill', async () => {
    (api.apiPost as any).mockResolvedValue(TEMPLATE);
    const user = userEvent.setup();
    render(<DocumentTemplatesCard canEdit />);

    await user.click(
      await screen.findByRole('button', { name: '+ New template' }),
    );
    expect(screen.getByText('{{firstName}}')).toBeInTheDocument();
    expect(screen.getByText('{{probationEndDate}}')).toBeInTheDocument();

    // fireEvent rather than user.type: `{{` is an escape sequence in
    // userEvent, and these fields are full of merge-field braces.
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Statement of main terms' },
    });
    fireEvent.change(screen.getByLabelText('Body (HTML)'), {
      target: { value: '<p>Dear {{firstName}}</p>' },
    });
    await user.click(screen.getByRole('button', { name: 'Create template' }));

    await waitFor(() =>
      expect(api.apiPost).toHaveBeenCalledWith('/document-templates', {
        name: 'Statement of main terms',
        body: '<p>Dear {{firstName}}</p>',
        documentType: 'CONTRACT',
        requiresAcknowledgement: true,
      }),
    );
    // The name lands twice: once in the list, once in the generate picker.
    expect(await screen.findAllByText('Statement of main terms')).toHaveLength(
      2,
    );
  });

  it('generates a document into the employee file', async () => {
    mockApi([TEMPLATE]);
    (api.apiPost as any).mockResolvedValue({
      id: 90,
      name: 'Statement of main terms — Ella Ng',
    });
    const user = userEvent.setup();
    render(<DocumentTemplatesCard canEdit />);

    await user.selectOptions(await screen.findByLabelText('Template'), '1');
    await user.selectOptions(screen.getByLabelText('Employee'), '5');
    await user.click(screen.getByRole('button', { name: 'Generate document' }));

    await waitFor(() =>
      expect(api.apiPost).toHaveBeenCalledWith(
        '/document-templates/1/generate',
        { employeeId: 5 },
      ),
    );
    expect(
      await screen.findByText(
        'Filed "Statement of main terms — Ella Ng" in their documents.',
      ),
    ).toBeInTheDocument();
  });

  it('hides the editing controls from a reader', async () => {
    mockApi([TEMPLATE]);
    render(<DocumentTemplatesCard canEdit={false} />);

    expect(
      await screen.findByText(/CONTRACT · needs acknowledgement/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '+ New template' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument();
  });
});
