Write comprehensive tests for: $ARGUMENTS

Testing conventions:
- **Backend:** Jest with ts-jest. Test files go in `backend/src/__tests__/`. Named `[filename].test.ts`.
- **Frontend:** Vitest with React Testing Library. Test files go in `frontend/src/__tests__/`. Named `[filename].test.tsx`.

Coverage requirements:
- Happy path (normal successful operation)
- Edge cases (empty arrays, null values, boundary conditions)
- Error states (invalid input, network failures, auth errors)

For backend routes, use supertest to make HTTP requests. For frontend components, use `@testing-library/react` render + user-event.
