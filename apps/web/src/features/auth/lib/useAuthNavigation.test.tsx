// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useAuthNavigation } from './useAuthNavigation';

vi.mock('../../cart/lib/afterSignIn', () => ({ continueAfterSignIn: vi.fn() }));

/** BroadcastChannel giả: đếm tin gửi cho tab khác (#508) */
const posted: unknown[] = [];
vi.stubGlobal(
  'BroadcastChannel',
  class {
    postMessage(data: unknown) {
      posted.push(data);
    }
    addEventListener() {}
    removeEventListener() {}
  },
);

function Finish() {
  const { finish } = useAuthNavigation();
  return (
    <button type="button" onClick={() => void finish()}>
      Xong
    </button>
  );
}

afterEach(cleanup);

describe('useAuthNavigation', () => {
  it('finish_announcesSignInToOtherTabs_once', async () => {
    // Arrange
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/login']}>
          <Finish />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Act: khách vừa đăng nhập ở tab này
    await userEvent.setup().click(screen.getByRole('button', { name: 'Xong' }));

    // Assert: các tab khác được báo, tin không kèm token, email, sub
    await waitFor(() => expect(posted).toEqual([{ type: 'auth-changed' }]));
  });
});
